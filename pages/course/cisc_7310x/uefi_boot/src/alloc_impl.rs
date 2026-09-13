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

/// # Safety
///
/// The caller must ensure `boot_services` is non-null and points to a live
/// `EFI_BOOT_SERVICES` table, valid for the rest of the program's
/// execution: every `alloc`/`dealloc` call for the lifetime of the
/// `#[global_allocator]` dereferences the pointer stored here without
/// re-checking it. Must be called before the first allocation (i.e.
/// before any `String`/`Vec`/`Box` use), and at most once — a second call
/// would let a later, possibly-stale `boot_services` value replace one
/// in-flight allocations' `dealloc` still depends on.
pub unsafe fn init(boot_services: *mut BootServices) {
    BOOT_SERVICES.store(boot_services, Ordering::Relaxed);
}

const HEADER: usize = size_of::<usize>();

pub struct EfiAllocator;

// SAFETY (unsafe impl):
// `GlobalAlloc`'s implementer obligation (core::alloc documentation): `alloc`
// must return either null or a pointer to a live block of memory of at
// least `layout.size()` bytes, aligned to at least `layout.align()`, valid
// until passed to `dealloc` (or `realloc`, unused here — its std-provided
// default is alloc+copy+dealloc, sound given `alloc`/`dealloc` are). This
// impl discharges that in `alloc`/`dealloc` below. The reciprocal caller
// obligation (`dealloc` receives only a pointer/layout pair a matching
// `alloc` call on this same allocator returned, exactly once) is an AXIOM
// from `GlobalAlloc`'s own documentation, upheld by every safe caller
// through this crate's `#[global_allocator]` — not something this impl
// re-verifies, per the trait's own division of responsibility.
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
        // SAFETY: `bs` non-null-checked above (LOCAL FACT) and traceable to
        // `efi_main`'s validated `system_table.boot_services` via `init`'s
        // own `# Safety` contract (this is `init`'s one intended reader);
        // `BootServices`'s ABI-prefix invariant covers `allocate_pool`.
        // `raw` is a local out-param the contract (UEFI spec §7.2) only
        // writes through.
        let status = unsafe { ((*bs).allocate_pool)(EFI_LOADER_DATA, total, &mut raw) };
        if !status_is_success(status) || raw.is_null() {
            return ptr::null_mut();
        }
        let raw_addr = raw as usize;
        let data_addr = (raw_addr + HEADER + align - 1) & !(align - 1);
        // SAFETY:
        // Operation: write a `usize` through `(data_addr - HEADER) as *mut usize`.
        // Contract: the pointer must be non-null, aligned for `usize`, and
        // the full write in-bounds of one live allocation.
        // Evidence:
        // - In-bounds: `data_addr >= raw_addr + HEADER` by construction of
        //   the round-up (`& !(align - 1)` only ever rounds up), so
        //   `data_addr - HEADER >= raw_addr`; `AllocatePool` guaranteed
        //   `total = size + align + HEADER` live bytes at `raw_addr`
        //   (evidenced by `status_is_success` above), and `data_addr -
        //   HEADER < raw_addr + total` since `data_addr <= raw_addr +
        //   HEADER + align - 1`. The write is one `usize`, entirely within
        //   that range.
        // - Alignment: `Layout::align()` is documented to always be a
        //   power of two (AXIOM, core::alloc::Layout), so `align =
        //   layout.align().max(8)` is a power-of-two `>= 8`, hence a
        //   multiple of 8; `data_addr`, rounded to a multiple of `align`,
        //   is therefore also a multiple of 8; `data_addr - HEADER
        //   (= data_addr - 8)` is a multiple of 8 too — sufficient
        //   alignment for a `usize` on this target.
        // - Non-null: `data_addr - HEADER >= raw_addr > 0` (`raw` was
        //   null-checked above).
        // Postcondition: the pool pointer this allocation actually owns
        // (`raw_addr`) is now recoverable from `data_addr - HEADER`, which
        // `dealloc` reads back below.
        unsafe { *((data_addr - HEADER) as *mut usize) = raw_addr };
        data_addr as *mut u8
    }

    unsafe fn dealloc(&self, ptr: *mut u8, _layout: Layout) {
        let bs = BOOT_SERVICES.load(Ordering::Relaxed);
        if bs.is_null() {
            return;
        }
        // SAFETY:
        // Operation: read a `usize` through `(ptr as usize - HEADER) as *const usize`.
        // Contract: non-null, aligned for `usize`, in-bounds, initialized.
        // Evidence: by `GlobalAlloc`'s own caller contract (AXIOM, see the
        // `unsafe impl` comment above), `ptr` is exactly a `data_addr` this
        // `alloc` returned; the write proved sound above wrote a `usize`
        // at precisely `data_addr - HEADER`, so this read targets the same,
        // still-live location (this allocator never moves or invalidates
        // it before `dealloc`).
        let raw_addr = unsafe { *((ptr as usize - HEADER) as *const usize) };
        // SAFETY: `bs` valid, same evidence as in `alloc`. Contract
        // (FreePool, UEFI spec §7.2): `buffer` must be a live pool
        // allocation from `AllocatePool`. `raw_addr` is exactly the
        // pointer `allocate_pool` returned for this allocation (read back
        // above), and has not been freed yet — this is the only `dealloc`
        // call for it, per `GlobalAlloc`'s caller contract (no
        // double-free).
        unsafe { ((*bs).free_pool)(raw_addr as *mut c_void) };
    }
}

#[global_allocator]
static ALLOCATOR: EfiAllocator = EfiAllocator;
