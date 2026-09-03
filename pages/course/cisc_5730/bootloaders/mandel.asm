; Mandelbrot in an x86 real-mode boot sector.
;
; Controls:  w a s d  pan by 64 pixels
;            q e      zoom out & in
;            r        reset

; ---------------------------------------------------------------------------
; Rendering is in VGA mode 13h (320x240x256).
;
; Numeric model uses Q16.16 based on BLOCK x BLOCK. The canvas is 65536 logical
; units in height and width, initially mapped
;
;   x0 = -192 * 1024 = -2.0        320 px * 1024 = 5.0     -> re in [-2.0,  3.0]
;   y0 = -100 * 1024 = -1.5625     200 px * 1024 = 3.125   -> im in [-1.5625, 1.5625]
;
; which covers the standard (-2, 0.5) x (-1.5, 1.5) region.  Zoom halves or
; doubles the per-pixel step about the centre of the screen, so the reachable
; range is BLOCK = 1024 down to 1, a 1024x magnification, at which point one
; pixel is one Q16.16 ulp and the fixed-point grid is exhausted.
;
; Products are calculated in 64 bits with the one-operand IMUL (EDX:EAX = EAX * r/m32) and
; renormalised with SHRD. At the top of the loop the escape test guarantees |z| < 2,
; but z' = z^2 + c can reach |z'| ~ 7.25 before the tst.
; 7.25 * 65536 squared is 2.3e11, well past 32 bits but comfortably inside 64.
;
; Main things I learned / had to troubleshoot:
;       immediate mode vga framebuffer
;       packing .mandel into registers
;       DOS 0x16h interrupts for keyboard
;


BITS 16
ORG 0x7C00

W       equ 320                 ; mode 13h dimensions
H       equ 200
SH      equ 16                  ; fixed point fraction bits
BLOCK   equ 1024                ; widest-zoom step, Q16.16 units per pixel
MAXIT   equ 128                 ; iteration cap
PAN     equ 6                   ; pan distance, log2(pixels)

start:
        ; Stop timer interrupts, since we do naughty things with sp
        cli
        ; xor     ax, ax
        ; mov     ds, ax
        ; mov     ss, ax
        mov     sp, 0x7C00
        ; cld
        mov     ax, 0x0013      ; VGA 320x200x256
        int     0x10
        push    0xA000
        pop     es

;   Registers and memory layout
;   eax, edx   scratch for imul/shrd
;   ebx        z.re
;   ecx        z.im
;   esi        c.re, until .mandel steals it for z.re^2 (zr2)
;   ebp        c.im, until .mandel steals it for z.im^2 (zi2)
;   edi        framebuffer offset
;   sp         iteration counter
;
;   [x0]       re of the top-left pixel (dd)
;   [y0]       im of the top-left pixel (dd)
;   [step]     Current zoom in Q16.16 units per pixel (dd)
;   [col]      row iteration counter of columns remaining (dw)
;   [cre]       c.re for this pixel, while esi is off holding z.re^2 (dd)
;   [cim]       c.im for this row, while ebp is off holding z.im^2 (dd)

frame:
        ; We're coopting bp and si as the two components of C
        xor     di, di
        mov     ebp, [y0]       ; ebp = c.im for this row
.row:
        mov     esi, [x0]       ; esi = c.re for this column
        mov     [cim], ebp      ; stash the row's c.im; ebp becomes zi2 scratch below
        mov     word [col], W
.col:
        xor     ebx, ebx        ; z.re
        xor     ecx, ecx        ; z.im
        mov     sp, MAXIT       ; steal the stack pointer as the iteration counter
        mov     [cre], esi      ; stash this pixel's c.re; esi becomes zr2 scratch below

.mandel:
        ; Square Z using imul, then normalize by shifting
        mov     eax, ebx
        imul    ebx             ; edx:eax = z.re^2
        shrd    eax, edx, SH
        mov     esi, eax        ; esi = zr2
        mov     eax, ecx
        imul    ecx             ; edx:eax = z.im^2
        shrd    eax, edx, SH
        mov     ebp, eax        ; ebp = zi2

        ; At this point we've calculated Z^2, we now check if we've diverged
        add     eax, esi
        cmp     eax, 4 << SH    ; |z|^2 >= 4 ?
        jge     .out

        ; Save the next iteration
        mov     eax, ebx
        imul    ecx             ; edx:eax = z.re * z.im
        shrd    eax, edx, SH-1  ; 2 * z.re * z.im
        add     eax, [cim]
        mov     ebx, esi
        sub     ebx, ebp
        add     ebx, [cre]      ; z.re' = z.re^2 - z.im^2 + c.re
        mov     ecx, eax        ; z.im' = 2 z.re z.im + c.im

        dec     sp
        jnz     .mandel
        xor     al, al          ; Final color is black
        jmp     .store

.out:
        mov     ax, sp
        add     al, 32          ; escaped: one of the 32 hue entries

; transition back from mandel iteration to frame iteration
.store:
        stosb
        mov     esi, [cre]      ; esi back to c.re, out of zr2 duty
        add     esi, [step]
        dec     word [col]
        jnz     .col
        mov     ebp, [cim]      ; ebp back to c.im, out of zi2 duty
        add     ebp, [step]
        cmp     di, W*H
        jb      .row

poll:
        mov     sp, 0x7C00      ; Restore the real stack pointer
        sti                     ; blocking int 0x16 needs IRQ1 to fill the buffer
        xor     ah, ah
        int     0x16
        cli                     ; back into sp-as-counter territory next frame
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
        cmp     al, 'r'
        je      .reset
        cmp     al, 'e'
        je      .zin
        cmp     al, 'q'
        jne     poll
.zout:
        mov     eax, [step]
        shl     eax, 1
        cmp     eax, BLOCK
        ja      poll             ; already at the widest view
        jmp     .zoom
.zin:
        mov     eax, [step]
        shr     eax, 1
        jz      poll             ; already at one ulp per pixel
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
.reset:
        mov     eax, -192 * BLOCK
        mov     [x0], eax
        mov     ebx, -100 * BLOCK
        mov     [y0], ebx 
        mov     ecx, BLOCK
        mov     [step], ecx 
        jmp     frame

; --- state ----------------------------------------------------------------
x0      dd      -192 * BLOCK    ; re of the top-left pixel
y0      dd      -100 * BLOCK    ; im of the top-left pixel
step    dd      BLOCK           ; Q16.16 units per pixel
col     dw      0
it      db      0
cre     dd      0
cim     dd      0

%if ($ - $$) > 510
%error "boot sector overflows 510 bytes"
%endif

        times   510 - ($ - $$) db 0
        dw      0xAA55
