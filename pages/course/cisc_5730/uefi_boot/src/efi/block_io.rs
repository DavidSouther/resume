//! `EFI_BLOCK_IO_PROTOCOL` (UEFI spec §13.9) to handle devices with Simple File Storage firmware.
//! Simple File Storage is based on FAT16/FAT32, so very minimal security features.

use super::types::{Guid, Lba, Status};
use core::ffi::c_void;

/// `EFI_BLOCK_IO_PROTOCOL_GUID` (§13.9).
pub const BLOCK_IO_PROTOCOL_GUID: Guid = Guid(
    0x964e_5b21,
    0x6459,
    0x11d2,
    [0x8e, 0x39, 0x00, 0xa0, 0xc9, 0x69, 0x72, 0x3b],
);

/// `EFI_BLOCK_IO_MEDIA` (§13.9) revision-1 fields
#[repr(C)]
pub struct BlockIoMedia {
    pub media_id: u32,
    pub removable_media: u8,
    pub media_present: u8,
    pub logical_partition: u8,
    pub read_only: u8,
    pub write_caching: u8,
    pub block_size: u32,
    pub io_align: u32,
    pub last_block: Lba,
}

type ResetFn = extern "efiapi" fn(this: *mut BlockIoProtocol, extended_verification: u8) -> Status;
type ReadBlocksFn = extern "efiapi" fn(
    this: *mut BlockIoProtocol,
    media_id: u32,
    lba: Lba,
    buffer_size: usize,
    buffer: *mut c_void,
) -> Status;
type WriteBlocksFn = extern "efiapi" fn(
    this: *mut BlockIoProtocol,
    media_id: u32,
    lba: Lba,
    buffer_size: usize,
    buffer: *const c_void,
) -> Status;
type FlushBlocksFn = extern "efiapi" fn(this: *mut BlockIoProtocol) -> Status;

#[repr(C)]
pub struct BlockIoProtocol {
    pub revision: u64,
    pub media: *mut BlockIoMedia,
    pub reset: ResetFn,
    pub read_blocks: ReadBlocksFn,
    pub write_blocks: WriteBlocksFn,
    pub flush_blocks: FlushBlocksFn,
}
