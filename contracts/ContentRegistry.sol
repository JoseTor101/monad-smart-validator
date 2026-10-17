// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ContentRegistry
/// @notice On-chain provenance and tamper-evident edit history for articles
///         and images. Stores only content hashes + metadata; the bytes live
///         off-chain (IPFS/Arweave/URL) addressed by `uri`.
/// @dev Addresses threat-model guarantees:
///      - Tamper-evident provenance: `author` is set once, never mutated.
///      - Append-only history: versions can only be pushed, never edited/removed.
///      - Duplicate guard: the exact same hash cannot be registered twice.
///      - Derivative tracking: content can be registered as a fork of a parent,
///        building a provenance graph instead of hiding copies.
contract ContentRegistry {
    enum Kind {
        Article,
        Image
    }

    struct Version {
        bytes32 contentHash; // SHA-256 / keccak of the off-chain bytes
        string uri; // ipfs://..., ar://..., or https URL
        uint256 timestamp;
        address editor; // who submitted this version
    }

    struct Content {
        address author; // original creator (immutable after register)
        Kind kind;
        uint256 createdAt;
        uint256 parentId; // 0 if original; >0 if a declared derivative/fork
        bool exists;
    }

    uint256 public nextId = 1;

    // Core storage. Versions kept in a separate mapping so Content stays a
    // fixed-size struct (cheaper, and avoids nested-array copy pitfalls).
    mapping(uint256 => Content) private _contents;
    mapping(uint256 => Version[]) private _versions;

    // Guards the "same bytes registered twice" attack and powers duplicate
    // detection. hashToId[h] == 0 means "never seen".
    mapping(bytes32 => uint256) public hashToId;

    event ContentRegistered(
        uint256 indexed id,
        address indexed author,
        bytes32 indexed contentHash,
        Kind kind,
        uint256 parentId
    );
    event ContentUpdated(
        uint256 indexed id,
        uint256 version,
        bytes32 indexed newHash,
        address editor
    );

    modifier contentExists(uint256 id) {
        require(_contents[id].exists, "No such content");
        _;
    }

    /// @notice Register brand-new, original content.
    /// @dev Reverts if these exact bytes were already registered (duplicate guard).
    function register(
        bytes32 contentHash,
        string calldata uri,
        Kind kind
    ) external returns (uint256 id) {
        return _registerInternal(contentHash, uri, kind, 0);
    }

    /// @notice Register content as a declared derivative of an existing piece.
    /// @dev Honesty-by-design: remixes/translations/edits-of-others link to a
    ///      parent instead of masquerading as original. Still gets its own
    ///      provenance and history.
    function registerDerivative(
        bytes32 contentHash,
        string calldata uri,
        Kind kind,
        uint256 parentId
    ) external contentExists(parentId) returns (uint256 id) {
        return _registerInternal(contentHash, uri, kind, parentId);
    }

    function _registerInternal(
        bytes32 contentHash,
        string calldata uri,
        Kind kind,
        uint256 parentId
    ) internal returns (uint256 id) {
        require(contentHash != bytes32(0), "Empty hash");
        require(hashToId[contentHash] == 0, "Content already registered");

        id = nextId++;
        Content storage c = _contents[id];
        c.author = msg.sender;
        c.kind = kind;
        c.createdAt = block.timestamp;
        c.parentId = parentId;
        c.exists = true;

        _versions[id].push(
            Version(contentHash, uri, block.timestamp, msg.sender)
        );
        hashToId[contentHash] = id;

        emit ContentRegistered(id, msg.sender, contentHash, kind, parentId);
    }

    /// @notice Append a new version. Only the original author may edit (MVP rule).
    /// @dev Append-only: existing versions are never touched, so the full
    ///      history stays tamper-evident.
    function update(
        uint256 id,
        bytes32 newHash,
        string calldata newUri
    ) external contentExists(id) {
        Content storage c = _contents[id];
        require(msg.sender == c.author, "Only author can update");
        require(newHash != bytes32(0), "Empty hash");
        require(hashToId[newHash] == 0, "Hash already used");

        _versions[id].push(
            Version(newHash, newUri, block.timestamp, msg.sender)
        );
        hashToId[newHash] = id;

        emit ContentUpdated(id, _versions[id].length - 1, newHash, msg.sender);
    }

    // --- Views -------------------------------------------------------------

    function getContent(uint256 id)
        external
        view
        contentExists(id)
        returns (
            address author,
            Kind kind,
            uint256 createdAt,
            uint256 parentId,
            uint256 numVersions
        )
    {
        Content storage c = _contents[id];
        return (c.author, c.kind, c.createdAt, c.parentId, _versions[id].length);
    }

    function authorOf(uint256 id) external view contentExists(id) returns (address) {
        return _contents[id].author;
    }

    function versionCount(uint256 id) external view contentExists(id) returns (uint256) {
        return _versions[id].length;
    }

    function getVersion(uint256 id, uint256 index)
        external
        view
        contentExists(id)
        returns (Version memory)
    {
        require(index < _versions[id].length, "No such version");
        return _versions[id][index];
    }

    function latestHash(uint256 id) external view contentExists(id) returns (bytes32) {
        Version[] storage v = _versions[id];
        return v[v.length - 1].contentHash;
    }

    /// @notice True if these exact bytes have ever been registered.
    function isRegistered(bytes32 contentHash) external view returns (bool) {
        return hashToId[contentHash] != 0;
    }
}
