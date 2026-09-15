//! A minimal, single-task async executor for the console's keystroke
//! wait.
//!
//! `BootServices::WaitForEvent` on
//! `SimpleTextInputProtocol::wait_for_key` (§7.1 / §12.3) is
//! signaled once firmware's own keyboard-servicing code — likely driven
//! internally by a real interrupt  — has buffered a keystroke.

use crate::efi::boot_services::BootServices;
use crate::efi::text::{InputKey, SimpleTextInputProtocol};
use crate::efi::types::{Event, EFI_NOT_READY};
use alloc::boxed::Box;
use core::future::Future;
use core::pin::Pin;
use core::task::{Context, Poll, Waker};

/// A `Future` that resolves to the next keystroke. 
/// The actual waiting happens in [`block_on`] in the gap between polls.
pub struct ReadKey(pub *mut SimpleTextInputProtocol);

impl Future for ReadKey {
    type Output = InputKey;

    fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<InputKey> {
        let con_in = self.0;
        let mut key = InputKey {
            scan_code: 0,
            unicode_char: 0,
        };
        // SAFETY: `con_in` is `ReadKey`'s only field, set by callers
        // (`console::read_line`) to a `con_in` traceable to `efi_main`'s
        // validated `system_table.con_in`, per the trust-boundary policy
        // in `efi/mod.rs`. `SimpleTextInputProtocol`'s ABI-prefix invariant
        // covers `read_key_stroke`; `key` is a local out-param the
        // contract (UEFI spec §12.3) only writes through.
        let status = unsafe { ((*con_in).read_key_stroke)(con_in, &mut key) };
        if status == EFI_NOT_READY {
            Poll::Pending
        } else {
            Poll::Ready(key)
        }
    }
}

/// Drives `fut` to completion. Every time it's `Pending`, this blocks in
/// `WaitForEvent` on `wait_event` — a real firmware call that only
/// returns once the event has been signaled — instead of spinning on
/// another poll. The `Waker` is a no-op: there's only ever one task in
/// flight here, so nothing ever needs to reschedule it; what actually
/// wakes this loop up is `WaitForEvent` returning.
///
/// `fut` is boxed because an `async fn`'s generated state machine isn't
/// generally `Unpin` (it may hold a borrow across an `.await` point), and
/// pinning it in a `Box` is the simplest sound way to call `poll` on it
/// more than once.
#[cfg(not(feature = "polling"))]
pub fn block_on<F: Future>(boot_services: *mut BootServices, wait_event: Event, fut: F) -> F::Output {
    let mut fut = Box::pin(fut);
    let waker = Waker::noop();
    let mut cx = Context::from_waker(waker);
    loop {
        if let Poll::Ready(value) = fut.as_mut().poll(&mut cx) {
            return value;
        }
        let mut events = [wait_event];
        let mut index = 0usize;
        // SAFETY: `boot_services` from `efi_main`
        // `events` is a local `[Event; 1]` array.
        // Ignoring the status: whether this returns EFI_SUCCESS or an
        // error, looping back to poll again is the correct next step
        let _ = unsafe { ((*boot_services).wait_for_event)(1, events.as_mut_ptr(), &mut index) };
    }
}

/// Drives `fut` to completion by spinning: every time it's `Pending`,
/// this polls again immediately, with no firmware call to block on.
/// `boot_services` and `wait_event` are unused here — they exist only so
/// callers (`Shell::run`) can call `block_on` identically under either
/// feature.
#[cfg(feature = "polling")]
pub fn block_on<F: Future>(_boot_services: *mut BootServices, _wait_event: Event, fut: F) -> F::Output {
    let mut fut = Box::pin(fut);
    let waker = Waker::noop();
    let mut cx = Context::from_waker(waker);
    loop {
        if let Poll::Ready(value) = fut.as_mut().poll(&mut cx) {
            return value;
        }
    }
}
