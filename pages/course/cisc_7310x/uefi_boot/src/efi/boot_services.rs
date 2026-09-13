//! `EFI_BOOT_SERVICES` (UEFI spec §4.4).
//!
//! Every field the real table has is declared, in spec order, so that the
//! offsets of the handful of functions we actually call (`AllocatePool`,
//! `FreePool`, `LocateHandleBuffer`, `HandleProtocol`, `Stall`) land where
//! firmware put them. Calls we never make are typed as opaque `usize`
//! (pointer-sized) slots rather than as real function-pointer types —
//! their signatures don't matter since nothing ever calls through them,
//! only their size (one pointer) does.

use super::types::{Guid, Handle, Status, TableHeader};
use core::ffi::c_void;

/// `EFI_LOCATE_SEARCH_TYPE` (§7.3): the only variant this project uses is
/// `ByProtocol`, to ask firmware for every handle exposing a given GUID.
#[repr(u32)]
#[allow(dead_code)]
pub enum LocateSearchType {
    AllHandles = 0,
    ByRegisterNotify = 1,
    ByProtocol = 2,
}

/// `EFI_MEMORY_TYPE` (§7.2 Table 7-3): pool allocations an application
/// makes before `ExitBootServices` should use `EfiLoaderData`.
pub const EFI_LOADER_DATA: u32 = 2;

type OpaqueFn = usize;

type AllocatePoolFn =
    extern "efiapi" fn(pool_type: u32, size: usize, buffer: *mut *mut c_void) -> Status;
type FreePoolFn = extern "efiapi" fn(buffer: *mut c_void) -> Status;
type HandleProtocolFn =
    extern "efiapi" fn(handle: Handle, protocol: *const Guid, interface: *mut *mut c_void) -> Status;
type LocateHandleBufferFn = extern "efiapi" fn(
    search_type: u32,
    protocol: *const Guid,
    search_key: *mut c_void,
    no_handles: *mut usize,
    buffer: *mut *mut Handle,
) -> Status;
type StallFn = extern "efiapi" fn(microseconds: usize) -> Status;

#[repr(C)]
pub struct BootServices {
    pub hdr: TableHeader,

    // Task Priority Services
    raise_tpl: OpaqueFn,
    restore_tpl: OpaqueFn,

    // Memory Services
    allocate_pages: OpaqueFn,
    free_pages: OpaqueFn,
    get_memory_map: OpaqueFn,
    pub allocate_pool: AllocatePoolFn,
    pub free_pool: FreePoolFn,

    // Event & Timer Services
    create_event: OpaqueFn,
    set_timer: OpaqueFn,
    wait_for_event: OpaqueFn,
    signal_event: OpaqueFn,
    close_event: OpaqueFn,
    check_event: OpaqueFn,

    // Protocol Handler Services
    install_protocol_interface: OpaqueFn,
    reinstall_protocol_interface: OpaqueFn,
    uninstall_protocol_interface: OpaqueFn,
    pub handle_protocol: HandleProtocolFn,
    reserved: OpaqueFn,
    register_protocol_notify: OpaqueFn,
    locate_handle: OpaqueFn,
    locate_device_path: OpaqueFn,
    install_configuration_table: OpaqueFn,

    // Image Services
    load_image: OpaqueFn,
    start_image: OpaqueFn,
    exit: OpaqueFn,
    unload_image: OpaqueFn,
    exit_boot_services: OpaqueFn,

    // Miscellaneous Services
    get_next_monotonic_count: OpaqueFn,
    pub stall: StallFn,
    set_watchdog_timer: OpaqueFn,

    // Driver Support Services
    connect_controller: OpaqueFn,
    disconnect_controller: OpaqueFn,

    // Open and Close Protocol Services
    open_protocol: OpaqueFn,
    close_protocol: OpaqueFn,
    open_protocol_information: OpaqueFn,

    // Library Services
    protocols_per_handle: OpaqueFn,
    pub locate_handle_buffer: LocateHandleBufferFn,
    locate_protocol: OpaqueFn,
    install_multiple_protocol_interfaces: OpaqueFn,
    uninstall_multiple_protocol_interfaces: OpaqueFn,

    // 32-bit CRC Services
    calculate_crc32: OpaqueFn,

    // Miscellaneous Services (cont'd)
    copy_mem: OpaqueFn,
    set_mem: OpaqueFn,
    create_event_ex: OpaqueFn,
}
