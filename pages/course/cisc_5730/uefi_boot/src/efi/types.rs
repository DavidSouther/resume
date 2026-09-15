//! Scalar types shared by UEFI structs and protocol bindings.
//!
//! Layouts and values are copied from the UEFI Specification 2.10.

use core::ffi::c_void;

/// `EFI_STATUS` (UINTN on real hardware; usize is the right analog on the
/// aarch64 UEFI target since UINTN is pointer-width there).
pub type Status = usize;

pub const EFI_SUCCESS: Status = 0;
/// High bit set marks an error per §2.3.1; the exact value isn't needed
/// beyond "non-zero, high bit set", but this is EFI_NOT_FOUND for reference.
#[allow(dead_code)]
pub const EFI_NOT_FOUND: Status = 0x8000_0000_0000_000E;
pub const EFI_NOT_READY: Status = 0x8000_0000_0000_0006;

#[inline]
pub fn status_is_success(status: Status) -> bool {
    status == EFI_SUCCESS
}

/// `EFI_HANDLE` — an opaque token, never dereferenced.
pub type Handle = *mut c_void;

/// `EFI_EVENT` (§7.1) — also an opaque token, distinct from `Handle` only
/// by spec convention (both are `VOID*`). Named separately so a
/// `wait_for_key`/`WaitForEvent` argument reads better.
pub type Event = *mut c_void;

/// `EFI_LBA` — logical block address (§13.9).
pub type Lba = u64;

/// `EFI_GUID` (§2.3.1): a 128-bit value laid out as one little-endian
/// `u32`, two little-endian `u16`s, and eight raw bytes.
#[repr(C)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Guid(pub u32, pub u16, pub u16, pub [u8; 8]);

/// `EFI_TABLE_HEADER` (§4.2), the common prefix of every UEFI table.
#[repr(C)]
pub struct TableHeader {
    pub signature: u64,
    pub revision: u32,
    pub header_size: u32,
    pub crc32: u32,
    pub reserved: u32,
}
