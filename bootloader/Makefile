IMG = mandelbrot.img
ASM = mandelbrot.asm

$(IMG): $(ASM)
	nasm -f bin $< -o $@

run: $(IMG)
	qemu-system-i386 -drive format=raw,file=$(IMG)

size: $(IMG)
	@wc -c < $(IMG)

clean:
	rm -f $(IMG)

.PHONY: run size clean
