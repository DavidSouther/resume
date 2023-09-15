"use client";
import { useLayoutEffect, useRef, useState } from "react";
import styles from "./shelf.module.css";

export default function Shelf() {
  return (
    <div className={styles.shelf}>
      <Bracket />
      <Bracket />
      <Bracket />
      <Bracket />
    </div>
  );
}

function Bracket() {
  const [offset, setOffset] = useState(0);
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    setOffset(pxToInch(ref.current?.offsetLeft ?? 0));
  }, []);
  return (
    <p ref={ref} className={styles.bracket}>
      {offset}"
    </p>
  );
}

function pxToInch(px: number): number {
  // return (px * window.devicePixelRatio) / 96;
  return px / 96;
}
