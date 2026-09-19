; 16 bit real mode, standard origin
BITS 16
ORG 0x7C00

    ; Clear the screen by reseting text mode
    mov ax, 0x0003
    int 0x10

    ; Load the message and prepare teletype output
    mov si, msg
    mov ah, 0x0e

print:
    lodsb
    or al, al
    jz done
    int 0x10
    jmp print

; Exit loop
done:
    hlt
    jmp done

msg:
    db "Hello", 0

; Guard to fail build instead of overflowing the boot sector,
; and the PC 
%if ($ - $$) > 510
%error "boot sector overflows 510 bytes"
%endif

times   510 - ($ - $$) db 0
dw      0xAA55 ; Should be the right endianness