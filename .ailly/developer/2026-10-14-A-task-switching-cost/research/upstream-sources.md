## umcontext/Makefile
```c
all: uctxswitch uctxmake uctxswap uctxrestore

CFLAGS=-Wall -c

uctxswitch: uctxswitch.o printctx.o
	$(CC) -o uctxswitch uctxswitch.o printctx.o

uctxmake: uctxmake.o printctx.o
	$(CC) -o uctxmake uctxmake.o printctx.o

uctxrestore: uctxrestore.o
	$(CC) -o uctxrestore uctxrestore.o

uctxswap: uctxswap.o printctx.o
	$(CC) -o uctxswap uctxswap.o printctx.o

clean: 
	$(RM) uctxswitch uctxswitch.o uctxmake uctxmake.o \
		uctxswap uctxswap.o uctxrestore uctxrestore.o \
		printctx.o

```
## umcontext/printctx.h
```c
#ifndef PRINTCTX_H
#define PRINTCTX_H

void print_ucontext(ucontext_t *uc);

#endif
```
## umcontext/printctx.c
```c
#define _GNU_SOURCE
#include <stdio.h>
#include <ucontext.h>

#include "printctx.h"

void print_ucontext(ucontext_t *uc) {
  printf("-------------------------------------------\n");
  printf("The (incomplete) user context:\n");
#ifdef __x86_64__
  printf("\tRegister RIP:  %llx\n", uc->uc_mcontext.gregs[REG_RIP]);
  printf("\tRegister RAX:  %llx\n", uc->uc_mcontext.gregs[REG_RAX]);
  printf("\tRegister RSP:  %llx\n", uc->uc_mcontext.gregs[REG_RSP]);
  printf("\tRegister RBP:  %llx\n", uc->uc_mcontext.gregs[REG_RBP]);
  printf("\tRegister RAX:  %llx\n", uc->uc_mcontext.gregs[REG_RAX]);
  printf("\tRegister RBX:  %llx\n", uc->uc_mcontext.gregs[REG_RBX]);
  printf("\tRegister RCX:  %llx\n", uc->uc_mcontext.gregs[REG_RCX]);
  printf("\tRegister RDX:  %llx\n", uc->uc_mcontext.gregs[REG_RDX]);
  printf("\tRegister RSI:  %llx\n", uc->uc_mcontext.gregs[REG_RSI]);
  printf("\tRegister RDI:  %llx\n", uc->uc_mcontext.gregs[REG_RDI]);
#else
  printf("\tRegister EIP:  %x\n", uc->uc_mcontext.gregs[REG_EIP]);
  printf("\tRegister CS:   %x\n", uc->uc_mcontext.gregs[REG_CS]);
  printf("\tRegister EAX:  %x\n", uc->uc_mcontext.gregs[REG_EAX]);
  printf("\tRegister EBX:  %x\n", uc->uc_mcontext.gregs[REG_EBX]);
  printf("\tRegister ECX:  %x\n", uc->uc_mcontext.gregs[REG_ECX]);
  printf("\tRegister EDX:  %x\n", uc->uc_mcontext.gregs[REG_EDX]);
  printf("\tRegister ESI:  %x\n", uc->uc_mcontext.gregs[REG_ESI]);
  printf("\tRegister EDI:  %x\n", uc->uc_mcontext.gregs[REG_EDI]);
  printf("\tRegister ESP:  %x\n", uc->uc_mcontext.gregs[REG_ESP]);
  printf("\tRegister EBP:  %x\n", uc->uc_mcontext.gregs[REG_EBP]);
#endif
  printf("-------------------------------------------\n");
}
```
## umcontext/uctxmake.c
```c
#include <stdio.h>
#include <stdlib.h>
#include <ucontext.h>

#include "printctx.h"

#define STACK_SIZE (1 << 14)

static void hello_user();
static void make_hu_context();

ucontext_t hu_context;

int main(int argc, char *argv[]) {
#ifdef __x86_64__
  printf("hello_user is at %lp\n", &hello_user);
#else
  printf("hello_user is at %p\n", &hello_user);
#endif
  make_hu_context();
  setcontext(&hu_context);
  return 0;
}

static void hello_user() { printf("From hello_user: Hello, User!\n"); }

static void make_hu_context() {
  getcontext(&hu_context);
  printf("Newly obtained hu_context:\n");
  print_ucontext(&hu_context);

  hu_context.uc_stack.ss_sp = malloc(STACK_SIZE);
  hu_context.uc_stack.ss_size = STACK_SIZE;

  makecontext(&hu_context, hello_user, 0);
  printf("hu_context made via makecontext:\n");
  print_ucontext(&hu_context);
}
```
## umcontext/uctxrestore.c
```c
#include <stdio.h>
#include <ucontext.h>
#include <unistd.h>

int main(int argc, const char *argv[]) {
  ucontext_t curr;

  getcontext(&curr);
  puts("After getcontext: Hello, World!");
  sleep(1);
  setcontext(&curr);
  puts("After setcontext: Hello, World!");
  return 0;
}
```
## umcontext/uctxswap.c
```c
#include <stdio.h>
#include <stdlib.h>
#include <ucontext.h>

#include "printctx.h"

static ucontext_t uctx_main, uctx_func1, uctx_func2;

#define handle_error(msg)                                                      \
  do {                                                                         \
    perror(msg);                                                               \
    exit(EXIT_FAILURE);                                                        \
  } while (0)

static void func1(void) {
  printf("func1: started\n");
  printf("func1: swapcontext(&uctx_func1, &uctx_func2)\n");
  if (swapcontext(&uctx_func1, &uctx_func2) == -1) {
    handle_error("swapcontext");
  }
  printf("func1: returning\n");
}

static void func2(void) {
  printf("func2: started\n");
  printf("func2: swapcontext(&uctx_func2, &uctx_func1)\n");
  if (swapcontext(&uctx_func2, &uctx_func1) == -1) {
    handle_error("swapcontext");
  }
  printf("func2: returning\n");
}

int main(int argc, char *argv[]) {
  char func1_stack[16384];
  char func2_stack[16384];

  printf("Function func1 is at: %p\n", &func1);
  printf("Function func2 is at: %p\n", &func2);
  printf("Function main is at:  %p\n", &main);

  if (getcontext(&uctx_func1) == -1) {
    handle_error("getcontext");
  }
  uctx_func1.uc_stack.ss_sp = func1_stack;
  uctx_func1.uc_stack.ss_size = sizeof(func1_stack);
  uctx_func1.uc_link = &uctx_main;
  makecontext(&uctx_func1, func1, 0);
  printf("Func1 ucontext: -----------------------\n");
  print_ucontext(&uctx_func1);

  if (getcontext(&uctx_func2) == -1) {
    handle_error("getcontext");
  }
  uctx_func2.uc_stack.ss_sp = func2_stack;
  uctx_func2.uc_stack.ss_size = sizeof(func2_stack);
  /* Successor context is f1(), unless argc > 1 */
  uctx_func2.uc_link = (argc > 1) ? NULL : &uctx_func1;
  makecontext(&uctx_func2, func2, 0);
  printf("Func2 ucontext: -----------------------\n");
  print_ucontext(&uctx_func2);

  printf("main: swapcontext(&uctx_main, &uctx_func2)\n");
  if (swapcontext(&uctx_main, &uctx_func2) == -1) {
    handle_error("swapcontext");
  }

  printf("main: exiting\n");
  exit(EXIT_SUCCESS);
}
```
## umcontext/uctxswitch.c
```c
#include <stdio.h>
#include <ucontext.h>

#include "printctx.h"

void func(void);

int ctx = 0;
ucontext_t context, *cp = &context;

int main(void) {
  getcontext(cp);
  printf("User mode context obtained!\n");
  print_ucontext(cp);

  if (!ctx) {
    printf("Saved context by calling getcontext. \n");
    func();
  } else {
    printf("Context restored by calling setcontext.\n");
  }
}

void func(void) {
  ctx++;
  setcontext(cp);
}
```
## umthread/Makefile
```c
all: umthreaddemo

umthreaddemo: umthreaddemo.o
	$(CC) -o umthreaddemo umthreaddemo.o 

clean:
	$(RM) umthreaddemo umthreaddemo.o
```
## umthread/umthreaddemo.c
```c
#include <stdio.h>
#include <stdlib.h>
#include <ucontext.h>
#include <unistd.h>

#define STACK_SIZE (1 << 14)

static void make_hu_context();
static void hello_user();

static void make_hw_context();
static void hello_world();
static ucontext_t m_context, hu_context, hw_context, main_context;
static int hu_exited = 0, hw_exited = 0;

int main(int argc, char *argv[]) {
  make_hu_context();
  make_hw_context();

  /* A simple non-preemptive round robin scheduler:
   * Below is the main dispatch loop */
  while (1) {
    if (hu_exited) {
      printf("The hello user thread has exited.\n");
    }
    if (hw_exited) {
      printf("The hello world thread has exited.\n");
    }

    /* no more threds to schedule */
    if (hw_exited && hu_exited) {
      break;
    }

    /* dispatch the hello user thread to CPU */
    if (!hu_exited) {
      swapcontext(&main_context, &hu_context);
    }

    /* dispatch the hellow world thread to CPU */
    if (!hw_exited) {
      swapcontext(&main_context, &hw_context);
    }
  }

  return 0;
}

static void hello_user() {
  for (int i = 0; i < 20; i++) {
    printf("[%03d]: Hello, User!\n", i);
    fflush(stdout);
    usleep(50000);

    /* yeild to the scheduler thread */
    if (!hw_exited) {
      swapcontext(&hu_context, &main_context);
    }
  }

  /* yeild to the scheduler thread */
  printf("hu exiting ...\n");
  hu_exited = 1;
  swapcontext(&hu_context, &main_context);
}

static void hello_world() {
  for (int i = 0; i < 10; i++) {
    printf("[%03d]: Hello, World!\n", i);
    fflush(stdout);
    usleep(50000);

    /* yeild to the scheduler thread */
    if (!hw_exited) {
      swapcontext(&hw_context, &main_context);
    }
  }

  /* yeild to the scheduler thread */
  printf("hw exiting ...\n");
  hw_exited = 1;
  swapcontext(&hw_context, &main_context);
}

static void make_hu_context() {
  getcontext(&hu_context);

  hu_context.uc_stack.ss_sp = malloc(STACK_SIZE);
  hu_context.uc_stack.ss_size = STACK_SIZE;

  makecontext(&hu_context, hello_user, 0);
}

static void make_hw_context() {
  getcontext(&hw_context);

  hw_context.uc_stack.ss_sp = malloc(STACK_SIZE);
  hw_context.uc_stack.ss_size = STACK_SIZE;

  makecontext(&hw_context, hello_world, 0);
}
```
