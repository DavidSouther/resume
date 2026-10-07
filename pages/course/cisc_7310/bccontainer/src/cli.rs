//! The command line: `bcdocker run <container> <app> [args...]`.

use std::path::Path;

use crate::container::{self, Container};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("usage: bcdocker run <container> <app> [args...]")]
    Usage,
}

/// The arguments as typed, before the container is looked up.
#[derive(Debug, PartialEq, Eq)]
pub struct Args {
    pub container: String,
    pub app: String,
    pub args: Vec<String>,
}

pub fn parse(args: impl IntoIterator<Item = String>) -> Result<Args, Error> {
    let args: Vec<String> = args.into_iter().collect();
    match args.as_slice() {
        [_, cmd, container, app, rest @ ..] if cmd == "run" => {
            Ok(Args { container: container.clone(), app: app.clone(), args: rest.to_vec() })
        }
        _ => Err(Error::Usage),
    }
}

#[derive(Debug)]
pub struct Run {
    pub container: Container,
    pub app: String,
    pub args: Vec<String>,
}

impl Run {
    pub fn resolve(args: Args, cwd: &Path) -> Result<Run, container::Error> {
        Ok(Run { container: Container::resolve(&args.container, cwd)?, app: args.app, args: args.args })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn argv(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn run_container_app_and_arguments_parse() {
        let args = parse(argv(&["bcdocker", "run", "tinysys", "/bin/ls", "-l", "--color"])).unwrap();

        assert_eq!(
            args,
            Args { container: "tinysys".into(), app: "/bin/ls".into(), args: argv(&["-l", "--color"]) }
        );
    }

    #[test]
    fn too_few_arguments_or_another_subcommand_is_usage() {
        for bad in [&["bcdocker"][..], &["bcdocker", "run"], &["bcdocker", "run", "tinysys"], &["bcdocker", "ps", "a", "b"]] {
            assert!(matches!(parse(argv(bad)), Err(Error::Usage)), "{bad:?}");
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
}
