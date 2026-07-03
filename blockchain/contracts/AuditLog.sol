// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AuditLog
/// @notice Immutable audit log for insider-threat events. Stores a SHA-256 hash
///         of each canonical event JSON plus a block timestamp. For the POC we
///         anchor one hash per event; production would anchor a periodic Merkle
///         root instead.
contract AuditLog {
    struct Record {
        bytes32 eventHash;
        uint256 timestamp;
        address recorder;
        string metadata; // e.g. "username:band:score"
    }

    Record[] private records;

    event EventAnchored(
        uint256 indexed index,
        bytes32 indexed eventHash,
        uint256 timestamp,
        address indexed recorder
    );

    /// @notice Anchor an event hash. Returns the record index.
    function anchorEvent(bytes32 eventHash, string calldata metadata)
        external
        returns (uint256)
    {
        uint256 index = records.length;
        records.push(
            Record({
                eventHash: eventHash,
                timestamp: block.timestamp,
                recorder: msg.sender,
                metadata: metadata
            })
        );
        emit EventAnchored(index, eventHash, block.timestamp, msg.sender);
        return index;
    }

    /// @notice Read a stored record by index.
    function getRecord(uint256 index)
        external
        view
        returns (bytes32, uint256, address, string memory)
    {
        require(index < records.length, "AuditLog: index out of range");
        Record storage r = records[index];
        return (r.eventHash, r.timestamp, r.recorder, r.metadata);
    }

    /// @notice Total number of anchored records.
    function totalRecords() external view returns (uint256) {
        return records.length;
    }
}
