//! A `GlobalAlloc` backed directly by `EFI_BOOT_SERVICES::AllocatePool` /
//! `FreePool` (§7.2). This is the only reason the shell can use `alloc`'s
//! `String`/`Vec` instead of hand-rolled fixed buffers — it is not a
//! "custom device driver", it's a thin adapter over a boot service every
//! compliant firmware already implements.
//!
//! `AllocatePool` returns 8-byte-aligned memory (§7.2). For the rare
//! request needing more alignment, we over-allocate and hand back a
//! rounded-up address, stashing the real pool pointer in the 8 bytes
//! immediately before it so `dealloc` can still find it.

use crate::efi::boot_services::{BootServices, EFI_LOADER_DATA};
use crate::efi::types::status_is_success;
use core::alloc::{GlobalAlloc, Layout};
use core::ffi::c_void;
use core::ptr;
use core::sync::atomic::{AtomicPtr, Ordering};

static BOOT_SERVICES: AtomicPtr<BootServices> = AtomicPtr::new(ptr::null_mut());

/// Called once from `efi_main`, before the first allocation.
pub fn init(boot_services: *mut BootServices) {
    BOOT_SERVICES.store(boot_services, Ordering::Relaxed);
}

const HEADER: usize = size_of::<usize>();

pub struct EfiAllocator;

unsafe impl GlobalAlloc for EfiAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let bs = BOOT_SERVICES.load(Ordering::Relaxed);
        if bs.is_null() {
            return ptr::null_mut();
        }
        let align = layout.align().max(8);
        // `layout.size()` is caller-chosen (via `alloc::alloc`, ultimately from
        // whatever `String`/`Vec` growth the shell does) and unbounded; adding
        // `align + HEADER` to it is *our* arithmetic, not part of `Layout`'s own
        // already-validated bound, so it needs its own overflow check rather
        // than assuming a huge request can't happen.
        let Some(total) = layout.size().checked_add(align).and_then(|n| n.checked_add(HEADER)) else {
            return ptr::null_mut();
        };
        let mut raw: *mut c_void = ptr::null_mut();
        let status = unsafe { ((*bs).allocate_pool)(EFI_LOADER_DATA, total, &mut raw) };
        if !status_is_success(status) || raw.is_null() {
            return ptr::null_mut();
        }
        let raw_addr = raw as usize;
        let data_addr = (raw_addr + HEADER + align - 1) & !(align - 1);
        unsafe { *((data_addr - HEADER) as *mut usize) = raw_addr };
        data_addr as *mut u8
    }

    unsafe fn dealloc(&self, ptr: *mut u8, _layout: Layout) {
        let bs = BOOT_SERVICES.load(Ordering::Relaxed);
        if bs.is_null() {
            return;
        }
        let raw_addr = unsafe { *((ptr as usize - HEADER) as *const usize) };
        unsafe { ((*bs).free_pool)(raw_addr as *mut c_void) };
    }
}

#[global_allocator]
static ALLOCATOR: EfiAllocator = EfiAllocator;
