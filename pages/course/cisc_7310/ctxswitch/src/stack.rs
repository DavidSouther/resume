//! Stacks for user-level contexts: page aligned `mmap` regions with a `PROT_NONE` guard page below
//! the usable bytes, the layout used by green thread runtimes such as Dzania's `rsroutine`
//! (https://github.com/dzania/rsroutine, described in "Green Threads from Scratch",
//! https://dzania.github.io/green-threads-from-scratch/). `rsroutine` declares no license, so this
//! is an independent implementation of the technique and no source was copied.
//!
//! The C examples used `malloc(STACK_SIZE)` for context stacks. A heap block has no guard, so an
//! overflow would silently corrupt neighbouring objects; these ports use guarded stacks instead.

use std::io;
use std::ptr::NonNull;

/// Smallest usable stack accepted: one page on every supported target.
pub const MIN_LEN: usize = 4096;

/// An owned `mmap` region used as a stack. The usable bytes are `[base(), base() + len())`.
pub struct Stack {
    // Safety invariant: `map` and `map_len` are exactly what `mmap` returned and was asked for; the
    // mapping stays mapped until `drop`; the first `guard` bytes are `PROT_NONE` and the
    // remaining `map_len - guard` bytes are read/write; `guard < map_len`.
    map: NonNull<u8>,
    map_len: usize,
    guard: usize,
}

impl Stack {
    /// A page aligned stack of at least `len` bytes (and at least [`MIN_LEN`]) with a guard page below it.
    pub fn guarded(len: usize) -> io::Result<Self> {
        if len < MIN_LEN {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "stack smaller than one page"));
        }
        // SAFETY: `sysconf` takes an integer name and has no memory preconditions.
        let page = usize::try_from(unsafe { libc::sysconf(libc::_SC_PAGESIZE) })
            .map_err(|_| io::Error::other("sysconf(_SC_PAGESIZE) failed"))?;
        let usable = len
            .checked_next_multiple_of(page)
            .ok_or_else(|| io::Error::other("stack size overflow"))?;
        let map_len = usable
            .checked_add(page)
            .ok_or_else(|| io::Error::other("stack size overflow"))?;
        // SAFETY: a null hint, a non-zero length (`map_len >= 2 * page`), valid flag constants and
        // fd -1 with MAP_ANONYMOUS are the documented arguments for a fresh private anonymous
        // mapping (mmap(2)). The result is compared with MAP_FAILED before use.
        let raw = unsafe {
            libc::mmap(
                std::ptr::null_mut(),
                map_len,
                libc::PROT_NONE,
                libc::MAP_PRIVATE | libc::MAP_ANONYMOUS,
                -1,
                0,
            )
        };
        if raw == libc::MAP_FAILED {
            return Err(io::Error::last_os_error());
        }
        let map = NonNull::new(raw.cast::<u8>()).ok_or_else(|| io::Error::other("mmap returned null"))?;
        // From here `stack` owns the mapping, so an early return unmaps it through `Drop`.
        let stack = Stack { map, map_len, guard: page };
        // SAFETY: `map` is page aligned (mmap(2): the result is a multiple of the page size), so
        // `map + page` is too; `[map + page, map + page + usable)` lies inside the `map_len` byte
        // mapping because `page + usable == map_len` (checked arithmetic above), so `add(page)`
        // stays within the one mapped object and `mprotect`'s range is wholly mapped.
        let rc = unsafe {
            libc::mprotect(map.as_ptr().add(page).cast(), usable, libc::PROT_READ | libc::PROT_WRITE)
        };
        if rc != 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(stack)
    }

    /// Lowest usable address.
    pub fn base(&mut self) -> *mut u8 {
        // SAFETY: `guard < map_len` (type invariant), so the offset is inside the mapping.
        unsafe { self.map.as_ptr().add(self.guard) }
    }

    /// Number of usable bytes (always at least [`MIN_LEN`]).
    pub fn len(&self) -> usize {
        self.map_len - self.guard
    }

    pub fn is_empty(&self) -> bool {
        false
    }

    /// One past the highest usable address; the stack pointer starts here and grows downward.
    pub fn top(&mut self) -> *mut u8 {
        // SAFETY: `guard + len() == map_len`, so the result is one past the end of the mapping,
        // which `pointer::add` permits (it is never dereferenced).
        unsafe { self.map.as_ptr().add(self.map_len) }
    }
}

impl Drop for Stack {
    fn drop(&mut self) {
        // SAFETY: `map` and `map_len` are exactly the values `mmap` returned and was given (type
        // invariant); `drop` runs once, so the region is not unmapped twice. Owners that run code
        // on this stack (`Fiber`, `Context`) leak the `Stack` instead of dropping it whenever a flow
        // has been entered and not finished, so no live frame is ever unmapped.
        unsafe { libc::munmap(self.map.as_ptr().cast(), self.map_len) };
    }
}
