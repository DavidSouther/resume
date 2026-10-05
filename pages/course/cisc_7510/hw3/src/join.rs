use std::io::Write;

use crate::disk::writer::JoinWriter;

pub trait Join {
    fn run<W: Write>(self, out: JoinWriter<W>);
}
