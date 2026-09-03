ASMS  := $(wildcard *.asm)
STEMS := $(ASMS:.asm=)

%.img: %.asm
	nasm -f bin $< -o $@

# `make hello`, `make mandel`, `make kernel`, ... build then boot that stem's image.
$(STEMS): %: %.img
	qemu-system-i386 -display cocoa,zoom-to-fit=on -drive format=raw,file=$<

clean:
	rm -f *.img

.PHONY: clean $(STEMS)
