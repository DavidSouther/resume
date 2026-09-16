//! `EFI_RUNTIME_SERVICES` (UEFI spec §4.5), limited to `ResetSystem`.

use super::types::{Status, TableHeader};

type OpaqueFn = usize;
type ResetSystemFn = extern "efiapi" fn(
    reset_type: u32,
    reset_status: Status,
    data_size: usize,
    reset_data: *const u16,
) -> !;

/// `EFI_RESET_TYPE` value that powers the guest down.
pub const EFI_RESET_SHUTDOWN: u32 = 2;

/// The prefix of `EFI_RUNTIME_SERVICES` through `ResetSystem`.
#[repr(C)]
pub struct RuntimeServices {
    pub hdr: TableHeader,
    get_time: OpaqueFn,
    set_time: OpaqueFn,
    get_wakeup_time: OpaqueFn,
    set_wakeup_time: OpaqueFn,
    set_virtual_address_map: OpaqueFn,
    convert_pointer: OpaqueFn,
    get_variable: OpaqueFn,
    get_next_variable_name: OpaqueFn,
    set_variable: OpaqueFn,
    get_next_high_monotonic_count: OpaqueFn,
    pub reset_system: ResetSystemFn,
}
