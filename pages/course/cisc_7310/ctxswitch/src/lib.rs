//! Kernel versus user-level task switching: ports of the `umcontext` and `umthread` examples
//! (H. Chen, https://github.com/huichen-cs/OSClassExamples) and the pieces `switchbench` measures.

#[cfg(not(all(target_os = "linux", target_env = "gnu")))]
compile_error!("ctxswitch needs Linux with glibc (ucontext); build and run it in a container, see tests/run.sh");

pub mod bench;
pub mod green;
pub mod regswitch;
pub mod stack;
pub mod uctx;
