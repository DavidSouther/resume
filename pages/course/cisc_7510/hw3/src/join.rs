use std::io::Write;

use crate::writer::JoinWriter;

pub trait Join {
    fn run<W: Write>(self, out: JoinWriter<W>);
}