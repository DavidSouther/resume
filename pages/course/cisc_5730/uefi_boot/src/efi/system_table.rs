//! `EFI_SYSTEM_TABLE` (UEFI spec §4.3) — the one struct pointer firmware
//! hands `efi_main`, from which everything else (console, boot services)
//! is reached.

use super::boot_services::BootServices;
use super::runtime_services::RuntimeServices;
use super::text::{SimpleTextInputProtocol, SimpleTextOutputProtocol};
use super::types::{Handle, TableHeader};

#[repr(C)]
pub struct SystemTable {
    pub hdr: TableHeader,
    pub firmware_vendor: *mut u16,
    pub firmware_revision: u32,
    pub console_in_handle: Handle,
    pub con_in: *mut SimpleTextInputProtocol,
    pub console_out_handle: Handle,
    pub con_out: *mut SimpleTextOutputProtocol,
    pub standard_error_handle: Handle,
    pub std_err: *mut SimpleTextOutputProtocol,
    pub runtime_services: *mut RuntimeServices,
    pub boot_services: *mut BootServices,
    // NumberOfTableEntries / ConfigurationTable follow; unused here.
}
