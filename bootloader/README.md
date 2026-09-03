# Mandelbrot boot sector

A Mandelbrot explorer that fits in the 512 bytes a PC BIOS will load for you.
No operating system, no libraries, no second sector.

```
make          # nasm -f bin mandelbrot.asm -o mandelbrot.img
make run      # qemu-system-i386 -drive format=raw,file=mandelbrot.img
```

| key | effect |
| --- | --- |
| `w` `a` `s` `d` | pan by 64 pixels |
| `q` | zoom out |
| `e` | zoom in |

## The numeric model

There is no FPU here, and there would be no room to talk to one. Everything is
signed Q16.16 fixed point in 32-bit registers: `1.0` is `65536`.

A pixel is a `BLOCK`-by-`BLOCK` square of that grid. At the widest zoom
`BLOCK` is `1024`, so one pixel is `1024/65536`, one sixty-fourth of a unit.
That sets the opening frame:

```
x0 = -128 * 1024 = -2.0        320 px * 1024 = 5.0      re in [-2.0,     3.0   ]
y0 = -100 * 1024 = -1.5625     200 px * 1024 = 3.125    im in [-1.5625,  1.5625]
```

which covers the whole set plus the requested `(-2, 0.5)` by `(-1.5, 1.5)`
window. Zoom halves or doubles the per-pixel step, so the reachable range is
`1024` down to `1` — a 1024x magnification, at which point one pixel is one
Q16.16 ulp and the grid is exhausted. Below that the arithmetic would have
nothing left to say.

Zoom keeps the centre of the screen fixed rather than the corner, so the
stored corner moves by `(W/2, H/2) * (step_old - step_new)` on every step. That
is the only multiply in the program that is not part of the fractal.

## Why 64-bit products

The obvious way to square a Q16.16 number is `imul eax, ebx` and `sar eax, 16`,
and it is wrong. That two-operand form keeps only the low 32 bits, and the
interesting values do not fit there.

The escape test at the top of the loop guarantees `|z| < 2`. But the value it
guards is the *previous* iterate: `z' = z^2 + c` can reach `|z'| ~ 7.25` before
the next test sees it, and `7.25 * 65536` squared is `2.3e11`. So each multiply
uses the one-operand `imul r/m32`, which puts the full 64-bit product in
`EDX:EAX`, and renormalises with `shrd` — a shift of the register pair that
keeps the low 32 bits of `product >> 16`. Exact to 64 bits before the shift,
and the low half is correct two's complement regardless of sign.

The cross term wants `2 * z.re * z.im`, so it shifts by 15 instead of 16 and
gets the doubling for free.

## Registers

The inner loop has no spare registers, so the screen pointer never moves out of
`DI` and the pixel is written with `stosb`:

```
esi  c.re          ebx  z.re          eax  scratch / product low
ebp  c.im          ecx  z.im          edx  product high
di   video offset
```

Iteration count, column count, and the two squares live in memory after the
code, inside the sector.

## Size

295 bytes of instructions plus 23 bytes of state — 318 total, 192 to spare in a
512-byte sector. The `%if ($ - $$) > 510` guard fails the build if that ever
stops being true.
