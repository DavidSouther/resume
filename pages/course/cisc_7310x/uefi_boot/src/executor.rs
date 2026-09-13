//! A minimal, single-task async executor for the console's keystroke
//! wait. This is not a general-purpose runtime — there's exactly one
//! thing this shell ever waits on at a time (the next key), so
//! [`block_on`] never juggles more than one `Future`, and there's no
//! scheduler beyond "poll, then let firmware tell us when to poll again".
//!
//! The "let firmware tell us" part is `BootServices::WaitForEvent` on
//! `SimpleTextInputProtocol::wait_for_key` (§7.1 / §12.3): that event is
//! signaled once firmware's own keyboard-servicing code — itself driven
//! by a real interrupt, one layer further down than this application is
//! allowed to reach — has buffered a keystroke. Waiting on it, instead of
//! repeatedly calling `ReadKeyStroke` and checking for `EFI_NOT_READY`, is
//! the actual difference between polling and being notified; see the
//! README's "I/O modes" section for the fuller version of this argument.

use crate::efi::boot_services::BootServices;
use crate::efi::text::{InputKey, SimpleTextInputProtocol};
use crate::efi::types::{Event, EFI_NOT_READY};
use alloc::boxed::Box;
use core::future::Future;
use core::pin::Pin;
use core::task::{Context, Poll, Waker};

/// A `Future` that resolves to the next keystroke. `poll` is exactly one
/// `ReadKeyStroke` call — all the actual waiting happens in [`block_on`],
/// in the gap between polls.
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
/// wakes this loop up is `WaitForEvent` returning, not the `Waker`
/// machinery `Future::poll` requires a `Context` to carry regardless.
///
/// `fut` is boxed because an `async fn`'s generated state machine isn't
/// generally `Unpin` (it may hold a borrow across an `.await` point), and
/// pinning it in a `Box` is the simplest sound way to call `poll` on it
/// more than once. The allocator behind that `Box` is our own
/// `AllocatePool`-backed one — see `alloc_impl.rs` — not an added
/// dependency.
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
        // SAFETY: `boot_services` is traceable to `efi_main`'s validated
        // `system_table.boot_services` (trust-boundary policy, `efi/
        // mod.rs`); `BootServices`'s ABI-prefix invariant covers
        // `wait_for_event`. `events` is a local `[Event; 1]` array, and
        // `number_of_events: 1` matches its length exactly (LOCAL FACT),
        // satisfying WaitForEvent's contract (UEFI spec §7.1) that `Event`
        // point to `NumberOfEvents` elements; `index` is a local out-param
        // the contract only writes through.
        // Ignoring the status: whether this returns EFI_SUCCESS or an
        // error, looping back to poll again is the correct next step
        // either way.
        let _ = unsafe { ((*boot_services).wait_for_event)(1, events.as_mut_ptr(), &mut index) };
    }
}
