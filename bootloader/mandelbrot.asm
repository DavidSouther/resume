; ---------------------------------------------------------------------------
; mandelbrot.asm - Mandelbrot explorer in a 512-byte x86 real-mode boot sector.
;
; Build:  nasm -f bin mandelbrot.asm -o mandelbrot.img
; Run:    qemu-system-i386 -drive format=raw,file=mandelbrot.img
;
; Controls:  w a s d  pan by 64 pixels
;            q        zoom out
;            e        zoom in
;
; ---------------------------------------------------------------------------
; Numeric model
;
; Everything is signed Q16.16 fixed point held in 32-bit registers: 1.0 is
; 65536.  A pixel is a BLOCK x BLOCK square of that grid, BLOCK = 1024 at the
; widest zoom, so one pixel is 1024/65536 = 1/64 of a unit.
;
;   x0 = -128 * 1024 = -2.0        320 px * 1024 = 5.0     -> re in [-2.0,  3.0]
;   y0 = -100 * 1024 = -1.5625     200 px * 1024 = 3.125   -> im in [-1.5625, 1.5625]
;
; which covers the requested (-2, 0.5) x (-1.5, 1.5) region.  Zoom halves or
; doubles the per-pixel step about the centre of the screen, so the reachable
; range is BLOCK = 1024 down to 1, a 1024x magnification, at which point one
; pixel is one Q16.16 ulp and the fixed-point grid is exhausted.
;
; Products are formed with the one-operand IMUL (EDX:EAX = EAX * r/m32) and
; renormalised with SHRD, so each multiply is exact to 64 bits before the
; shift.  That is what keeps the iteration honest: at the top of the loop the
; escape test guarantees |z| < 2, but z' = z^2 + c can reach |z'| ~ 7.25 before
; the *next* test sees it, and 7.25 * 65536 squared is 2.3e11 - well past 32
; bits, comfortably inside 64.
; ---------------------------------------------------------------------------

BITS 16
ORG 0x7C00

W       equ 320                 ; mode 13h dimensions
H       equ 200
SH      equ 16                  ; fixed point fraction bits
BLOCK   equ 1024                ; widest-zoom step, Q16.16 units per pixel
MAXIT   equ 128                 ; iteration cap
PAN     equ 6                   ; pan distance, log2(pixels)

start:
        xor     ax, ax
        mov     ds, ax
        mov     ss, ax
        mov     sp, 0x7C00
        cld
        mov     ax, 0x0013      ; VGA 320x200x256
        int     0x10
        push    0xA000
        pop     es

; --- draw one frame -------------------------------------------------------
frame:
        xor     di, di
        mov     ebp, [y0]       ; ebp = c.im for this row
.row:
        mov     esi, [x0]       ; esi = c.re for this column
        mov     word [col], W
.col:
        call    mandel
        stosb
        add     esi, [step]
        dec     word [col]
        jnz     .col
        add     ebp, [step]
        cmp     di, W*H
        jb      .row

; --- poll the keyboard ----------------------------------------------------
key:
        xor     ah, ah
        int     0x16
        mov     edx, [step]
        shl     edx, PAN        ; pan delta = 64 * step
        cmp     al, 'a'
        je      .left
        cmp     al, 'd'
        je      .right
        cmp     al, 'w'
        je      .up
        cmp     al, 's'
        je      .down
        cmp     al, 'e'
        je      .zin
        cmp     al, 'q'
        jne     key
.zout:
        mov     eax, [step]
        shl     eax, 1
        cmp     eax, BLOCK
        ja      key             ; already at the widest view
        jmp     short .zoom
.zin:
        mov     eax, [step]
        shr     eax, 1
        jz      key             ; already at one ulp per pixel
.zoom:
        mov     ecx, [step]
        sub     ecx, eax        ; d = step_old - step_new
        mov     [step], eax
        imul    edx, ecx, W/4
        shl     edx, 1          ; (W/2) * d
        add     [x0], edx
        imul    edx, ecx, H/2
        add     [y0], edx       ; corner moves, centre stays put
        jmp     frame
.left:
        sub     [x0], edx
        jmp     frame
.right:
        add     [x0], edx
        jmp     frame
.up:
        sub     [y0], edx
        jmp     frame
.down:
        add     [y0], edx
        jmp     frame

; --- escape-time iteration ------------------------------------------------
; in:  esi = c.re, ebp = c.im    out: al = colour    clobbers eax ebx ecx edx
mandel:
        xor     ebx, ebx        ; z.re
        xor     ecx, ecx        ; z.im
        mov     byte [it], MAXIT
.iter:
        mov     eax, ebx
        imul    ebx             ; edx:eax = z.re^2
        shrd    eax, edx, SH
        mov     [zr2], eax
        mov     eax, ecx
        imul    ecx             ; edx:eax = z.im^2
        shrd    eax, edx, SH
        mov     [zi2], eax
        add     eax, [zr2]
        cmp     eax, 4 << SH    ; |z|^2 >= 4 ?
        jge     .out
        mov     eax, ebx
        imul    ecx             ; edx:eax = z.re * z.im
        shrd    eax, edx, SH-1  ; 2 * z.re * z.im
        add     eax, ebp
        mov     ebx, [zr2]
        sub     ebx, [zi2]
        add     ebx, esi        ; z.re' = z.re^2 - z.im^2 + c.re
        mov     ecx, eax        ; z.im' = 2 z.re z.im + c.im
        dec     byte [it]
        jnz     .iter
        xor     al, al          ; inside the set: black
        ret
.out:
        mov     al, [it]
        and     al, 31
        add     al, 32          ; escaped: one of the 32 hue entries
        ret

; --- state ----------------------------------------------------------------
x0      dd      -128 * BLOCK    ; re of the top-left pixel
y0      dd      -100 * BLOCK    ; im of the top-left pixel
step    dd      BLOCK           ; Q16.16 units per pixel
col     dw      0
it      db      0
zr2     dd      0
zi2     dd      0

%if ($ - $$) > 510
%error "boot sector overflows 510 bytes"
%endif

        times   510 - ($ - $$) db 0
        dw      0xAA55
