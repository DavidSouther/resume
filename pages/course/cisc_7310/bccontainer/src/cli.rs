//! The command line: `bcdocker run [--stack-size <size>] <container> <app> [args...]`.

use std::path::Path;

use crate::{
    container::{self, Container},
    stack::{self, StackSize},
};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("usage: bcdocker run [--stack-size <size>] <container> <app> [args...]")]
    Usage,
    #[error("usage: unknown option {0:?} (bcdocker run [--stack-size <size>] <container> <app> [args...])")]
    UnknownOption(String),
    #[error(transparent)]
    StackSize(#[from] stack::Error),
}

/// The arguments as typed, before the container is looked up.
#[derive(Debug, PartialEq, Eq)]
pub struct Args {
    pub container: String,
    pub app: String,
    pub args: Vec<String>,
    pub stack_size: StackSize,
}

/// `bcdocker run [--stack-size <size>] <container> <app> [args...]`. Options come before the
/// container; everything after the application is the application's own arguments.
pub fn parse(args: impl IntoIterator<Item = String>) -> Result<Args, Error> {
    let mut rest = args.into_iter().skip(1); // the program name
    if rest.next().as_deref() != Some("run") {
        return Err(Error::Usage);
    }
    let mut stack_size = StackSize::default();
    let container = loop {
        let arg = rest.next().ok_or(Error::Usage)?;
        if arg == "--stack-size" {
            stack_size = StackSize::parse(&rest.next().ok_or(Error::Usage)?)?;
        } else if let Some(value) = arg.strip_prefix("--stack-size=") {
            stack_size = StackSize::parse(value)?;
        } else if arg.starts_with('-') {
            return Err(Error::UnknownOption(arg));
        } else {
            break arg;
        }
    };
    let app = rest.next().ok_or(Error::Usage)?;
    Ok(Args { container, app, args: rest.collect(), stack_size })
}

#[derive(Debug)]
pub struct Run {
    pub container: Container,
    pub app: String,
    pub args: Vec<String>,
    pub stack_size: StackSize,
}

impl Run {
    pub fn resolve(args: Args, cwd: &Path) -> Result<Run, container::Error> {
        Ok(Run {
            container: Container::resolve(&args.container, cwd)?,
            app: args.app,
            args: args.args,
            stack_size: args.stack_size,
        })
    }
}

#[cfg(test)]
mod tests {
    use std::assert_matches;

    use super::*;

    fn argv(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn run_container_app_and_arguments_parse() {
        let args = parse(argv(&["bcdocker", "run", "tinysys", "/bin/ls", "-l", "--color"])).unwrap();

        assert_eq!(
            args,
            Args {
                container: "tinysys".into(),
                app: "/bin/ls".into(),
                args: argv(&["-l", "--color"]),
                stack_size: StackSize::default(),
            }
        );
    }

    #[test]
    fn too_few_arguments_or_another_subcommand_is_usage() {
        for bad in [&["bcdocker"][..], &["bcdocker", "run"], &["bcdocker", "run", "tinysys"], &["bcdocker", "ps", "a", "b"]] {
            assert_matches!(parse(argv(bad)), Err(Error::Usage), "{bad:?}");
        }
    }

    #[test]
    fn run_resolves_the_container_against_the_working_directory() {
        let cwd = crate::container::tests::Scratch::new().with_dir("containers/tinysys");
        let args = parse(argv(&["bcdocker", "run", "tinysys", "/bin/sh"])).unwrap();

        let run = Run::resolve(args, cwd.path()).unwrap();

        assert_eq!(run.container.hostname().as_str(), "tinysys");
        assert_eq!(run.app, "/bin/sh");
    }

    #[test]
    fn a_stack_size_option_comes_before_the_container() {
        for form in [&["--stack-size", "2M"][..], &["--stack-size=2M"]] {
            let mut line = vec!["bcdocker", "run"];
            line.extend(form);
            line.extend(["tinysys", "/bin/sh"]);

            let args = parse(argv(&line)).unwrap();

            assert_eq!(args.stack_size.bytes(), 2 << 20, "{form:?}");
            assert_eq!(args.container, "tinysys");
            assert_eq!(args.app, "/bin/sh");
        }
    }

    #[test]
    fn options_after_the_container_belong_to_the_application() {
        let args = parse(argv(&["bcdocker", "run", "tinysys", "/bin/ls", "--stack-size", "3"])).unwrap();

        assert_eq!(args.stack_size, StackSize::default());
        assert_eq!(args.args, argv(&["--stack-size", "3"]));
    }

    #[test]
    fn a_missing_option_value_is_usage_and_an_unknown_option_is_named() {
        assert_matches!(parse(argv(&["bcdocker", "run", "--stack-size"])), Err(Error::Usage));
        assert_matches!(
            parse(argv(&["bcdocker", "run", "--bogus", "tinysys", "/bin/sh"])),
            Err(Error::UnknownOption(name)) if name == "--bogus"
        );
    }

    #[test]
    fn a_bad_stack_size_reports_the_size_error() {
        let err = parse(argv(&["bcdocker", "run", "--stack-size", "64K", "tinysys", "/bin/sh"])).unwrap_err();

        assert_matches!(err, Error::StackSize(stack::Error::OutOfRange { .. }));
        assert_eq!(err.to_string(), "stack size: 64K is outside 1M to 1G");
    }
}
