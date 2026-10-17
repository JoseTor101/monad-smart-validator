// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ContentRegistry
/// @notice Registers the SHA-256 fingerprint of an article or image, remembers who registered it
///         first and when, keeps an append-only list of versions, and counts attest/dispute votes
///         per version.
/// @dev Proves integrity, not truth. Only hashes and a short link are stored, never the content.
///      There is no owner, no admin and no setter: nothing can be changed after the fact except by
///      appending a version (author only) or adding a vote (once per wallet per version).
contract ContentRegistry {
    enum Kind {
        Article,
        Image
    }

    struct Version {
        bytes32 hash;
        string uri;
        uint64 timestamp;
        uint32 attestCount;
        uint32 disputeCount;
    }

    struct Content {
        address author;
        Kind kind;
        Version[] versions;
    }

    /// @dev Where a fingerprint lives. `id == 0` means "not registered" (ids start at 1).
    struct Ref {
        uint256 id;
        uint256 version;
    }

    uint256 public constant MAX_URI_BYTES = 512;

    uint256 private _lastId;
    mapping(uint256 => Content) private _contents;
    mapping(bytes32 => Ref) private _hashRef;
    // id => version => wallet => has voted
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) private _voted;

    event Registered(uint256 indexed id, address indexed author, bytes32 hash, Kind kind, string uri);
    event Updated(uint256 indexed id, uint256 version, bytes32 hash, string uri);
    event Attested(uint256 indexed id, uint256 version, address indexed voter, bool support);

    // ---------------------------------------------------------------- writes

    /// @notice Register new content. The caller becomes its permanent author.
    /// @param hash SHA-256 fingerprint of the content, computed by the caller off-chain.
    /// @param uri Link to where the content can be found (1..512 bytes, required).
    /// @param kind Article or Image.
    /// @return id The new content id (starts at 1).
    function register(bytes32 hash, string calldata uri, Kind kind) external returns (uint256 id) {
        _requireFreshHash(hash);
        _requireValidUri(uri);

        id = ++_lastId;
        Content storage c = _contents[id];
        c.author = msg.sender;
        c.kind = kind;
        c.versions.push(Version(hash, uri, uint64(block.timestamp), 0, 0));
        _hashRef[hash] = Ref(id, 0);

        emit Registered(id, msg.sender, hash, kind, uri);
    }

    /// @notice Append a new version. Only the author can do this; old versions are never changed.
    /// @return version The index of the new version.
    function update(uint256 id, bytes32 newHash, string calldata newUri) external returns (uint256 version) {
        Content storage c = _existing(id);
        require(msg.sender == c.author, "Not the author");
        _requireFreshHash(newHash);
        _requireValidUri(newUri);

        version = c.versions.length;
        c.versions.push(Version(newHash, newUri, uint64(block.timestamp), 0, 0));
        _hashRef[newHash] = Ref(id, version);

        emit Updated(id, version, newHash, newUri);
    }

    /// @notice Attest (support = true) or dispute (false) one version. Once per wallet per version.
    /// @dev Counts are raw and unweighted. A new version starts at 0/0.
    function attest(uint256 id, uint256 version, bool support) external {
        Content storage c = _existing(id);
        require(version < c.versions.length, "Version does not exist");
        require(!_voted[id][version][msg.sender], "Already voted on this version");

        _voted[id][version][msg.sender] = true;
        Version storage v = c.versions[version];
        if (support) {
            v.attestCount += 1;
        } else {
            v.disputeCount += 1;
        }

        emit Attested(id, version, msg.sender, support);
    }

    // ----------------------------------------------------------------- reads

    /// @notice Find which content and version a fingerprint belongs to.
    function lookup(bytes32 hash) external view returns (bool found, uint256 id, uint256 version) {
        Ref memory r = _hashRef[hash];
        return (r.id != 0, r.id, r.version);
    }

    function getContent(uint256 id) external view returns (address author, Kind kind, uint256 versionCount_) {
        Content storage c = _existing(id);
        return (c.author, c.kind, c.versions.length);
    }

    function getVersion(uint256 id, uint256 version)
        external
        view
        returns (bytes32 hash, string memory uri, uint64 timestamp, uint32 attestCount, uint32 disputeCount)
    {
        Content storage c = _existing(id);
        require(version < c.versions.length, "Version does not exist");
        Version storage v = c.versions[version];
        return (v.hash, v.uri, v.timestamp, v.attestCount, v.disputeCount);
    }

    function versionCount(uint256 id) external view returns (uint256) {
        return _existing(id).versions.length;
    }

    function latestHash(uint256 id) external view returns (bytes32) {
        Version[] storage vs = _existing(id).versions;
        return vs[vs.length - 1].hash;
    }

    function hasVoted(uint256 id, uint256 version, address who) external view returns (bool) {
        return _voted[id][version][who];
    }

    // --------------------------------------------------------------- helpers

    function _existing(uint256 id) private view returns (Content storage c) {
        c = _contents[id];
        require(c.author != address(0), "Content does not exist");
    }

    function _requireFreshHash(bytes32 hash) private view {
        require(hash != bytes32(0), "Hash is empty");
        require(_hashRef[hash].id == 0, "Hash already registered");
    }

    function _requireValidUri(string calldata uri) private pure {
        uint256 len = bytes(uri).length;
        require(len > 0, "Link is required");
        require(len <= MAX_URI_BYTES, "Link is too long");
    }
}
