//! `EFI_GRAPHICS_OUTPUT_PROTOCOL` (UEFI spec §12.9)

use super::types::Guid;

/// `EFI_GRAPHICS_OUTPUT_PROTOCOL_GUID` (§12.9).
pub const GRAPHICS_OUTPUT_PROTOCOL_GUID: Guid = Guid(
    0x9042_a9de,
    0x23dc,
    0x4a38,
    [0x96, 0xfb, 0x7a, 0xde, 0xd0, 0x80, 0x51, 0x6a],
);

/// `EFI_GRAPHICS_PIXEL_FORMAT` (§12.9) has defined values.
pub const PIXEL_FORMAT_NAMES: [&str; 4] = [
    "RGBReserved8BitPerColor",
    "BGRReserved8BitPerColor",
    "BitMask",
    "BltOnly",
];

/// `EFI_GRAPHICS_OUTPUT_MODE_INFORMATION` (§12.9).
#[repr(C)]
pub struct GraphicsOutputModeInformation {
    pub version: u32,
    pub horizontal_resolution: u32,
    pub vertical_resolution: u32,
    pub pixel_format: u32,
    pub pixel_information: [u32; 4],
    pub pixels_per_scan_line: u32,
}

/// `EFI_GRAPHICS_OUTPUT_PROTOCOL_MODE` (§12.9).
#[repr(C)]
pub struct GraphicsOutputProtocolMode {
    pub max_mode: u32,
    pub mode: u32,
    pub info: *mut GraphicsOutputModeInformation,
    pub size_of_info: usize,
    pub frame_buffer_base: u64,
    pub frame_buffer_size: usize,
}

type OpaqueFn = usize;

#[repr(C)]
pub struct GraphicsOutputProtocol {
    query_mode: OpaqueFn,
    set_mode: OpaqueFn,
    blt: OpaqueFn,
    pub mode: *mut GraphicsOutputProtocolMode,
}
