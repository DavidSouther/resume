//! Enumerates the UEFI Block IO and Graphics Output handles present at
//! boot into a two-level, sysfs-style tree: `/` lists devices, each device
//! lists a fixed set of attribute files. There is no third level — a real
//! sysfs nests arbitrarily, but every device this project shows (a disk,
//! a GPU, a USB stick) fits in one flat set of attributes, so a deeper
//! tree would just be unused generality.

use crate::efi::block_io::{BlockIoMedia, BlockIoProtocol, BLOCK_IO_PROTOCOL_GUID};
use crate::efi::boot_services::{BootServices, LocateSearchType};
use crate::efi::graphics::{GraphicsOutputProtocol, GRAPHICS_OUTPUT_PROTOCOL_GUID, PIXEL_FORMAT_NAMES};
use crate::efi::types::{status_is_success, Guid, Handle};
use alloc::format;
use alloc::string::{String, ToString};
use alloc::vec::Vec;
use core::ffi::c_void;

pub struct BlockDevice {
    pub protocol: *mut BlockIoProtocol,
    pub media_id: u32,
    pub removable: bool,
    pub media_present: bool,
    pub logical_partition: bool,
    pub read_only: bool,
    pub block_size: u32,
    pub last_block: u64,
}

pub struct GopDevice {
    pub horizontal_resolution: u32,
    pub vertical_resolution: u32,
    pub pixel_format: u32,
    pub max_mode: u32,
    pub current_mode: u32,
    pub frame_buffer_base: u64,
    pub frame_buffer_size: usize,
}

pub enum DeviceKind {
    Block(BlockDevice),
    Gop(GopDevice),
}

pub struct Device {
    pub name: String,
    pub kind: DeviceKind,
}

impl Device {
    /// Attribute filenames `ls` shows inside this device's directory.
    pub fn attribute_names(&self) -> &'static [&'static str] {
        match &self.kind {
            DeviceKind::Block(_) => &[
                "info",
                "media_id",
                "block_size",
                "last_block",
                "removable",
                "read_only",
                "logical_partition",
                "media_present",
                "data",
            ],
            DeviceKind::Gop(_) => &[
                "info",
                "resolution",
                "pixel_format",
                "max_mode",
                "current_mode",
                "frame_buffer_base",
                "frame_buffer_size",
            ],
        }
    }

    /// Renders an attribute file's text contents. `None` means the name
    /// isn't one of this device's attributes.
    pub fn read_attribute(&self, name: &str) -> Option<String> {
        match &self.kind {
            DeviceKind::Block(b) => match name {
                "info" => Some(format!(
                    "kind: block\r\nmedia_id: {}\r\nblock_size: {}\r\nlast_block: {}\r\nremovable: {}\r\nread_only: {}\r\nlogical_partition: {}\r\nmedia_present: {}\r\n",
                    b.media_id, b.block_size, b.last_block, b.removable, b.read_only, b.logical_partition, b.media_present
                )),
                "media_id" => Some(b.media_id.to_string()),
                "block_size" => Some(b.block_size.to_string()),
                "last_block" => Some(b.last_block.to_string()),
                "removable" => Some(b.removable.to_string()),
                "read_only" => Some(b.read_only.to_string()),
                "logical_partition" => Some(b.logical_partition.to_string()),
                "media_present" => Some(b.media_present.to_string()),
                _ => None,
            },
            DeviceKind::Gop(g) => match name {
                "info" => Some(format!(
                    "kind: gpu\r\nresolution: {}x{}\r\npixel_format: {}\r\nmax_mode: {}\r\ncurrent_mode: {}\r\nframe_buffer_base: 0x{:x}\r\nframe_buffer_size: {}\r\n",
                    g.horizontal_resolution,
                    g.vertical_resolution,
                    pixel_format_name(g.pixel_format),
                    g.max_mode,
                    g.current_mode,
                    g.frame_buffer_base,
                    g.frame_buffer_size
                )),
                "resolution" => Some(format!("{}x{}", g.horizontal_resolution, g.vertical_resolution)),
                "pixel_format" => Some(pixel_format_name(g.pixel_format).to_string()),
                "max_mode" => Some(g.max_mode.to_string()),
                "current_mode" => Some(g.current_mode.to_string()),
                "frame_buffer_base" => Some(format!("0x{:x}", g.frame_buffer_base)),
                "frame_buffer_size" => Some(g.frame_buffer_size.to_string()),
                _ => None,
            },
        }
    }
}

fn pixel_format_name(format: u32) -> &'static str {
    PIXEL_FORMAT_NAMES
        .get(format as usize)
        .copied()
        .unwrap_or("Unknown")
}

/// # Safety
///
/// The caller must ensure `boot_services` is non-null and points to a live
/// `EFI_BOOT_SERVICES` table (the ABI-prefix invariant, `efi/mod.rs`, for
/// at least `locate_handle_buffer`/`handle_protocol`/`free_pool`), valid
/// for the duration of this call. `guid` needs no extra obligation beyond
/// what `&Guid` already guarantees.
unsafe fn locate_protocol_instances(
    boot_services: *mut BootServices,
    guid: &Guid,
) -> Vec<*mut c_void> {
    let mut count: usize = 0;
    let mut buffer: *mut Handle = core::ptr::null_mut();
    // SAFETY:
    // Operation: deref `boot_services`, call `locate_handle_buffer` through it.
    // Contract: `boot_services` valid (this function's own precondition,
    // held by the caller for the call's duration); `guid`/`count`/`buffer`
    // are local out-params LocateHandleBuffer is documented to only read
    // (`guid`) or write (`count`, `buffer`) (UEFI spec §7.3).
    let status = unsafe {
        ((*boot_services).locate_handle_buffer)(
            LocateSearchType::ByProtocol as u32,
            guid as *const Guid,
            core::ptr::null_mut(),
            &mut count,
            &mut buffer,
        )
    };
    if !status_is_success(status) || buffer.is_null() {
        return Vec::new();
    }
    // SAFETY:
    // Operation: `core::slice::from_raw_parts(buffer, count)`.
    // Contract: `buffer` non-null, aligned for `Handle`, valid for reads of
    // `count * size_of::<Handle>()` bytes, pointing to `count` initialized
    // `Handle` values, all in one live allocation, for the slice's lifetime.
    // Evidence:
    // - FIRMWARE CONTRACT (UEFI spec §7.3, LocateHandleBuffer): on success,
    //   `*NoHandles` is the exact element count and `*Buffer` is a pool
    //   allocation of exactly that many initialized `EFI_HANDLE` values.
    // - `status_is_success(status)` and `!buffer.is_null()` were just
    //   checked above (LOCAL FACT); `count`/`buffer` are locals no other
    //   code can have mutated since.
    // - `Handle = *mut c_void` (TYPE FACT): any bit pattern is a valid
    //   value at this type, so "initialized" only needs pointer-sized
    //   writes, which the same firmware contract guarantees.
    // Postcondition: `handles` does not outlive this function, so its
    // lifetime is trivially within `buffer`'s (which this function frees
    // only after `handles` goes out of scope, below).
    let handles = unsafe { core::slice::from_raw_parts(buffer, count) };
    let mut out = Vec::with_capacity(count);
    for &handle in handles {
        let mut interface: *mut c_void = core::ptr::null_mut();
        // SAFETY: same as the `locate_handle_buffer` call above —
        // `boot_services` valid per this function's precondition;
        // `handle` is one of the `Handle` values just read out of
        // `handles`, which HandleProtocol (UEFI spec §7.3) accepts as
        // opaque input, never dereferencing it itself.
        let status =
            unsafe { ((*boot_services).handle_protocol)(handle, guid as *const Guid, &mut interface) };
        if status_is_success(status) && !interface.is_null() {
            out.push(interface);
        }
    }
    // SAFETY: `boot_services` valid per this function's precondition;
    // `buffer` is exactly the pointer `locate_handle_buffer` returned via
    // `AllocatePool` above and has not been freed yet, satisfying
    // `FreePool`'s contract (UEFI spec §7.2) that its argument must be a
    // live pool allocation.
    unsafe { ((*boot_services).free_pool)(buffer as *mut c_void) };
    out
}

/// Called once at startup; the result is a snapshot — a disk that's
/// hot-plugged mid-session won't appear without a re-scan, which this
/// minimal shell doesn't offer.
pub fn enumerate(boot_services: *mut BootServices) -> Vec<Device> {
    let mut devices = Vec::new();

    // SAFETY: `boot_services` is `enumerate`'s own parameter, which by this
    // module's only caller (`efi_main`) is `system_table.boot_services`,
    // valid per `efi_main`'s `# Safety` contract for this program's
    // lifetime — satisfying `locate_protocol_instances`'s precondition.
    let block_protocols = unsafe { locate_protocol_instances(boot_services, &BLOCK_IO_PROTOCOL_GUID) };
    let mut blk_index = 0;
    for raw in block_protocols {
        // `raw` came back from `HandleProtocol(handle, &BLOCK_IO_PROTOCOL_GUID, ...)`
        // just above; the FIRMWARE CONTRACT for `HandleProtocol` (UEFI spec
        // §7.3) is that a non-null result for that GUID points to a live
        // `EFI_BLOCK_IO_PROTOCOL`, so this cast doesn't change the
        // pointee's real type, only how we're allowed to talk about it.
        let protocol = raw as *mut BlockIoProtocol;
        // SAFETY: `protocol` valid per the FIRMWARE CONTRACT above, and
        // `BlockIoProtocol`'s field order is the ABI-prefix invariant
        // (`efi/mod.rs`) up through `media`, the only field read here.
        let media_ptr = unsafe { (*protocol).media };
        if media_ptr.is_null() {
            continue;
        }
        // SAFETY:
        // Operation: `&*media_ptr` (reference creation).
        // Contract: non-null, aligned, live, initialized `BlockIoMedia`
        // for the reference's lifetime (this loop iteration).
        // Evidence: `media_ptr` was just null-checked (LOCAL FACT); the
        // FIRMWARE CONTRACT for a live `EFI_BLOCK_IO_PROTOCOL`'s `Media`
        // field (UEFI spec §13.9) is that, when non-null, it points to a
        // live, initialized `EFI_BLOCK_IO_MEDIA`; `BlockIoMedia`'s layout
        // is the ABI-prefix invariant up through `last_block`, every field
        // read below.
        let media: &BlockIoMedia = unsafe { &*media_ptr };
        devices.push(Device {
            name: format!("blk{blk_index}"),
            kind: DeviceKind::Block(BlockDevice {
                protocol,
                media_id: media.media_id,
                removable: media.removable_media != 0,
                media_present: media.media_present != 0,
                logical_partition: media.logical_partition != 0,
                read_only: media.read_only != 0,
                block_size: media.block_size,
                last_block: media.last_block,
            }),
        });
        blk_index += 1;
    }

    // SAFETY: same as the Block IO call above — `boot_services` valid per
    // `efi_main`'s `# Safety` contract.
    let gop_protocols =
        unsafe { locate_protocol_instances(boot_services, &GRAPHICS_OUTPUT_PROTOCOL_GUID) };
    let mut gop_index = 0;
    for raw in gop_protocols {
        // Same FIRMWARE CONTRACT as the Block IO cast above, for
        // GRAPHICS_OUTPUT_PROTOCOL_GUID instead.
        let protocol = raw as *mut GraphicsOutputProtocol;
        // SAFETY: `protocol` valid per the FIRMWARE CONTRACT above;
        // `GraphicsOutputProtocol`'s ABI-prefix invariant covers `mode`,
        // the only field read here.
        let mode_ptr = unsafe { (*protocol).mode };
        if mode_ptr.is_null() {
            continue;
        }
        // SAFETY: `mode_ptr` null-checked above (LOCAL FACT); FIRMWARE
        // CONTRACT for a live `EFI_GRAPHICS_OUTPUT_PROTOCOL`'s `Mode`
        // field (UEFI spec §12.9) is that, when non-null, it points to a
        // live, initialized `EFI_GRAPHICS_OUTPUT_PROTOCOL_MODE`;
        // `GraphicsOutputProtocolMode`'s ABI-prefix invariant covers every
        // field read from `mode` here.
        let mode = unsafe { &*mode_ptr };
        let info_ptr = mode.info;
        if info_ptr.is_null() {
            continue;
        }
        // SAFETY: `info_ptr` null-checked above (LOCAL FACT); same
        // FIRMWARE CONTRACT pattern as `mode_ptr` applies to `Mode->Info`
        // (UEFI spec §12.9); `GraphicsOutputModeInformation`'s ABI-prefix
        // invariant covers every field read from `info` here.
        let info = unsafe { &*info_ptr };
        devices.push(Device {
            name: format!("gop{gop_index}"),
            kind: DeviceKind::Gop(GopDevice {
                horizontal_resolution: info.horizontal_resolution,
                vertical_resolution: info.vertical_resolution,
                pixel_format: info.pixel_format,
                max_mode: mode.max_mode,
                current_mode: mode.mode,
                frame_buffer_base: mode.frame_buffer_base,
                frame_buffer_size: mode.frame_buffer_size,
            }),
        });
        gop_index += 1;
    }

    devices
}
