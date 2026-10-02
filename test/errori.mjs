// Prove di js/errori.js (F3): gli errori del compilatore e dei programmi, spiegati in italiano. Senza browser e senza rete.
// Lancia con: node test/errori.mjs
// - VERE: uscite vere, catturate su un Mac (Apple clang 17, LC_ALL=C; Python 3.13) da piccoli programmi rotti.
//   I percorsi dei file Python sono stati accorciati in /Users/studente/lab/, il resto è identico.
// - SCRITTE: gcc su Linux, MinGW, gcc in italiano, MSVC, javac, Java e i crash su Windows, scritte a mano sul formato noto
//   di quei compilatori. Vanno confermate sulle macchine vere (gcc in italiano: LANG=it_IT.UTF-8 su Linux).
// - DAL VIVO: se nel PATH c'è un compilatore C (o Python 3), compila ed esegue dei programmi rotti e controlla che Lode
//   li riconosca. Così ci si accorge subito se i messaggi cambiano fra versioni e sistemi. Senza compilatore si salta.
import * as E from '../js/errori.js';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Uscite vere, catturate con Apple clang 17 (macOS arm64, LC_ALL=C) e Python 3.13 sui file in SORGENTI e su altri piccoli programmi rotti.
const VERE = {
  "pv": "pv.c:3:14: error: expected ';' at end of declaration\n    3 |     int x = 5\n      |              ^\n      |              ;\n1 error generated.\n",
  "nondich": "nondich.c:5:20: error: use of undeclared identifier 'nodo'\n    5 |     printf(\"%d\\n\", nodo);\n      |                    ^\n1 error generated.\n",
  "include": "include.c:2:5: error: call to undeclared library function 'printf' with type 'int (const char *, ...)'; ISO C99 and later do not support implicit function declarations [-Wimplicit-function-declaration]\n    2 |     printf(\"ciao\\n\");\n      |     ^\ninclude.c:2:5: note: include the header <stdio.h> or explicitly provide a declaration for 'printf'\ninclude.c:3:15: error: call to undeclared library function 'malloc' with type 'void *(unsigned long)'; ISO C99 and later do not support implicit function declarations [-Wimplicit-function-declaration]\n    3 |     char *p = malloc(10);\n      |               ^\ninclude.c:3:15: note: include the header <stdlib.h> or explicitly provide a declaration for 'malloc'\ninclude.c:3:11: warning: unused variable 'p' [-Wunused-variable]\n    3 |     char *p = malloc(10);\n      |           ^\n1 warning and 2 errors generated.\n",
  "implicita": "implicita.c:3:13: error: call to undeclared function 'calcola'; ISO C99 and later do not support implicit function declarations [-Wimplicit-function-declaration]\n    3 |     int r = calcola(3);\n      |             ^\n1 error generated.\n",
  "formato": "formato.c:4:20: warning: format specifies type 'int' but the argument has type 'double' [-Wformat]\n    4 |     printf(\"%d\\n\", media);\n      |             ~~     ^~~~~\n      |             %f\n1 warning generated.\n",
  "scanf": "scanf.c:4:17: warning: format specifies type 'int *' but the argument has type 'int' [-Wformat]\n    4 |     scanf(\"%d\", n);\n      |            ~~   ^\nscanf.c:4:17: warning: variable 'n' is uninitialized when used here [-Wuninitialized]\n    4 |     scanf(\"%d\", n);\n      |                 ^\nscanf.c:3:10: note: initialize the variable 'n' to silence this warning\n    3 |     int n;\n      |          ^\n      |           = 0\n2 warnings generated.\n",
  "ret": "ret.c:4:1: warning: non-void function does not return a value in all control paths [-Wreturn-type]\n    4 | }\n      | ^\nret.c:6:9: warning: unused variable 'c' [-Wunused-variable]\n    6 |     int c = n * 2;\n      |         ^\nret.c:7:1: warning: non-void function does not return a value [-Wreturn-type]\n    7 | }\n      | ^\n3 warnings generated.\n",
  "assegna": "assegna.c:4:11: warning: using the result of an assignment as a condition without parentheses [-Wparentheses]\n    4 |     if (x = 5) {\n      |         ~~^~~\nassegna.c:4:11: note: place parentheses around the assignment to silence this warning\n    4 |     if (x = 5) {\n      |           ^  \n      |         (    )\nassegna.c:4:11: note: use '==' to turn this assignment into an equality comparison\n    4 |     if (x = 5) {\n      |           ^\n      |           ==\nassegna.c:7:14: warning: using the result of an assignment as a condition without parentheses [-Wparentheses]\n    7 |     while (x = 0) { }\n      |            ~~^~~\nassegna.c:7:14: note: place parentheses around the assignment to silence this warning\n    7 |     while (x = 0) { }\n      |              ^  \n      |            (    )\nassegna.c:7:14: note: use '==' to turn this assignment into an equality comparison\n    7 |     while (x = 0) { }\n      |              ^\n      |              ==\n2 warnings generated.\n",
  "puntint": "puntint.c:5:11: warning: comparison between pointer and integer ('char *' and 'int') [-Wpointer-integer-compare]\n    5 |     if (p == 'c') printf(\"si\\n\");\n      |         ~ ^  ~~~\npuntint.c:6:14: warning: result of comparison against a string literal is unspecified (use an explicit string comparison function instead) [-Wstring-compare]\n    6 |     if (s[0] == \"c\") printf(\"si\\n\");\n      |              ^  ~~~\npuntint.c:6:14: warning: comparison between pointer and integer ('char' and 'char *') [-Wpointer-integer-compare]\n    6 |     if (s[0] == \"c\") printf(\"si\\n\");\n      |         ~~~~ ^  ~~~\n3 warnings generated.\n",
  "incomp": "incomp.c:6:11: warning: incompatible pointer types initializing 'char *' with an expression of type 'int[3]' [-Wincompatible-pointer-types]\n    6 |     char *q = v;\n      |           ^   ~\nincomp.c:7:12: warning: incompatible pointer types passing 'int[3]' to parameter of type 'char *' [-Wincompatible-pointer-types]\n    7 |     stampa(v);\n      |            ^\nincomp.c:1:19: note: passing argument to parameter 's' here\n    1 | void stampa(char *s);\n      |                   ^\nincomp.c:8:7: error: incompatible integer to pointer conversion assigning to 'int *' from 'int'; take the address with & [-Wint-conversion]\n    8 |     p = x;\n      |       ^ ~\n      |         &\nincomp.c:9:7: error: incompatible pointer to integer conversion assigning to 'int' from 'int *'; dereference with * [-Wint-conversion]\n    9 |     x = p;\n      |       ^ ~\n      |         *\nincomp.c:6:11: warning: unused variable 'q' [-Wunused-variable]\n    6 |     char *q = v;\n      |           ^\n3 warnings and 2 errors generated.\n",
  "nonusata": "nonusata.c:2:9: warning: unused variable 'contatore' [-Wunused-variable]\n    2 |     int contatore;\n      |         ^~~~~~~~~\nnonusata.c:4:13: warning: variable 'y' is uninitialized when used here [-Wuninitialized]\n    4 |     int z = y + 1;\n      |             ^\nnonusata.c:3:10: note: initialize the variable 'y' to silence this warning\n    3 |     int y;\n      |          ^\n      |           = 0\n2 warnings generated.\n",
  "graffa": "graffa.c:6:2: error: expected '}'\n    6 | }\n      |  ^\ngraffa.c:2:16: note: to match this '{'\n    2 | int main(void) {\n      |                ^\n1 error generated.\n",
  "parentesi": "parentesi.c:3:19: error: expected ')'\n    3 |     int x = (3 + 4;\n      |                   ^\nparentesi.c:3:13: note: to match this '('\n    3 |     int x = (3 + 4;\n      |             ^\nparentesi.c:5:15: error: expected ')'\n    5 |     if (x > 2 {\n      |               ^\nparentesi.c:5:8: note: to match this '('\n    5 |     if (x > 2 {\n      |        ^\n2 errors generated.\n",
  "argomenti": "argomenti.c:3:20: error: too few arguments to function call, expected 2, have 1\n    3 |     int x = somma(1);\n      |             ~~~~~  ^\nargomenti.c:1:5: note: 'somma' declared here\n    1 | int somma(int a, int b) { return a + b; }\n      |     ^     ~~~~~~~~~~~~\nargomenti.c:4:25: error: too many arguments to function call, expected 2, have 3\n    4 |     int y = somma(1, 2, 3);\n      |             ~~~~~       ^\nargomenti.c:1:5: note: 'somma' declared here\n    1 | int somma(int a, int b) { return a + b; }\n      |     ^     ~~~~~~~~~~~~\n2 errors generated.\n",
  "conflitto": "conflitto.c:2:8: error: conflicting types for 'doppio'\n    2 | double doppio(int x) { return x * 2.0; }\n      |        ^\nconflitto.c:1:5: note: previous declaration is here\n    1 | int doppio(int x);\n      |     ^\n1 error generated.\n",
  "ridef": "ridef.c:3:9: error: redefinition of 'x'\n    3 |     int x = 2;\n      |         ^\nridef.c:2:9: note: previous definition is here\n    2 |     int x = 1;\n      |         ^\n1 error generated.\n",
  "indice": "indice.c:5:13: error: subscripted value is not an array, pointer, or vector\n    5 |     return n[0] + v[0];\n      |            ~^~\nindice.c:4:5: warning: array index 5 is past the end of the array (that has type 'int[5]') [-Warray-bounds]\n    4 |     v[5] = 1;\n      |     ^ ~\nindice.c:3:5: note: array 'v' declared here\n    3 |     int v[5] = {0};\n      |     ^\n1 warning and 1 error generated.\n",
  "freccia": "freccia.c:5:14: error: member reference type 'struct nodo *' is a pointer; did you mean to use '->'?\n    5 |     int a = p.val;\n      |             ~^\n      |              ->\nfreccia.c:6:14: error: member reference type 'struct nodo' is not a pointer; did you mean to use '.'?\n    6 |     int b = n->val;\n      |             ~^~\n      |              .\nfreccia.c:7:16: error: no member named 'valore' in 'struct nodo'\n    7 |     int c = p->valore;\n      |             ~  ^\n3 errors generated.\n",
  "header": "header.c:1:10: fatal error: 'stdoi.h' file not found\n    1 | #include <stdoi.h>\n      |          ^~~~~~~~~\n1 error generated.\n",
  "assegnabile": "assegnabile.c:4:10: error: array type 'char[10]' is not assignable\n    4 |     nome = \"Anna\";\n      |     ~~~~ ^\nassegnabile.c:6:11: error: expression is not assignable\n    6 |     a + 1 = b;\n      |     ~~~~~ ^\n2 errors generated.\n",
  "tipo": "tipo.c:2:5: error: use of undeclared identifier 'bool'\n    2 |     bool fatto = true;\n      |     ^\ntipo.c:3:5: error: use of undeclared identifier 'string'\n    3 |     string s = \"ciao\";\n      |     ^\n2 errors generated.\n",
  "virgolette": "virgolette.c:3:12: warning: missing terminating '\"' character [-Winvalid-pp-token]\n    3 |     printf(\"ciao\\n);\n      |            ^\nvirgolette.c:3:12: error: expected expression\nvirgolette.c:5:2: error: expected '}'\n    5 | }\n      |  ^\nvirgolette.c:2:16: note: to match this '{'\n    2 | int main(void) {\n      |                ^\n1 warning and 2 errors generated.\n",
  "operandi": "operandi.c:4:15: error: invalid operands to binary expression ('struct p' and 'struct p')\n    4 |     int c = a + b;\n      |             ~ ^ ~\n1 error generated.\n",
  "vuoto": "vuoto.c:3:15: warning: if statement has empty body [-Wempty-body]\n    3 |     if (x > 5);\n      |               ^\nvuoto.c:3:15: note: put the semicolon on a separate line to silence this warning\nvuoto.c:7:7: warning: equality comparison result unused [-Wunused-comparison]\n    7 |     x == 4;\n      |     ~~^~~~\nvuoto.c:7:7: note: use '=' to turn this equality comparison into an assignment\n    7 |     x == 4;\n      |       ^~\n      |       =\n2 warnings generated.\n",
  "locale": "locale.c:3:12: warning: address of stack memory associated with local variable 'v' returned [-Wreturn-stack-address]\n    3 |     return v;\n      |            ^\n1 warning generated.\n",
  "segni": "segni.c:5:23: warning: comparison of integers of different signs: 'int' and 'unsigned long' [-Wsign-compare]\n    5 |     for (int i = 0; i < strlen(s); i++) c++;\n      |                     ~ ^ ~~~~~~~~~\n1 warning generated.\n",
  "voidret": "voidret.c:1:21: error: void function 'saluta' should not return a value [-Wreturn-mismatch]\n    1 | void saluta(void) { return 1; }\n      |                     ^      ~\nvoidret.c:2:20: error: non-void function 'prendi' should return a value [-Wreturn-mismatch]\n    2 | int prendi(void) { return; }\n      |                    ^\n2 errors generated.\n",
  "mainvoid": "mainvoid.c:1:1: error: 'main' must return 'int'\n    1 | void main(void) { }\n      | ^~~~\n      | int\n1 error generated.\n",
  "divzero": "divzero.c:1:38: warning: division by zero is undefined [-Wdivision-by-zero]\n    1 | int main(void) { int a = 5; return a / 0; }\n      |                                      ^ ~\n1 warning generated.\n",
  "ecc": "ecc.c:1:36: warning: excess elements in array initializer [-Wexcess-initializers]\n    1 | int main(void) { int v[2] = {1, 2, 3}; return v[0]; }\n      |                                    ^\n1 warning generated.\n",
  "printfarg": "printfarg.c:2:41: warning: more '%' conversions than data arguments [-Wformat-insufficient-args]\n    2 | int main(void) { int a = 1; printf(\"%d %d\\n\", a); printf(\"%d\\n\", a, a); return 0; }\n      |                                        ~^\nprintfarg.c:2:69: warning: data argument not used by format string [-Wformat-extra-args]\n    2 | int main(void) { int a = 1; printf(\"%d %d\\n\", a); printf(\"%d\\n\", a, a); return 0; }\n      |                                                          ~~~~~~     ^\n2 warnings generated.\n",
  "espr": "espr.c:2:13: error: expected expression\n    2 |     int x = ;\n      |             ^\n1 error generated.\n",
  "stack": "stack.c:1:14: warning: all paths through this function will call itself [-Winfinite-recursion]\n    1 | int f(int n) { return f(n + 1) + 1; }\n      |              ^\n1 warning generated.\n",
  "linker-mancante": "Undefined symbols for architecture arm64:\n  \"_calcola\", referenced from:\n      _main in link1-6e4fa8.o\nld: symbol(s) not found for architecture arm64\nclang: error: linker command failed with exit code 1 (use -v to see invocation)\n",
  "linker-doppio": "duplicate symbol '_conta' in:\n    /private/var/folders/xx/T/dup2-beb67e.o\n    /private/var/folders/xx/T/dup1-c96927.o\nld: 1 duplicate symbols\nclang: error: linker command failed with exit code 1 (use -v to see invocation)\n",
  "linker-senza-main": "Undefined symbols for architecture arm64:\n  \"_main\", referenced from:\n      <initial-undefines>\nld: symbol(s) not found for architecture arm64\nclang: error: linker command failed with exit code 1 (use -v to see invocation)\n",
  "segfault-bash": "/bin/bash: line 1: 72427 Segmentation fault: 11  /tmp/lode_seg\n",
  "assert-mac": "Assertion failed: (x == 4), function main, file ass.c, line 4.\n/bin/bash: line 1: 72450 Abort trap: 6           /tmp/lode_ass\n",
  "double-free-bash": "/bin/bash: line 1: 72442 Abort trap: 6           /tmp/lode_dfree\n",
  "asan-heap": "=================================================================\n==72463==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x603000001cd4 at pc 0x000104cc45e4 bp 0x00016b13ae90 sp 0x00016b13ae88\nWRITE of size 4 at 0x603000001cd4 thread T0\n    #0 0x000104cc45e0 in main heap.c:4\n    #1 0x000185b0c270  (<unknown module>)\n\n0x603000001cd4 is located 0 bytes after 20-byte region [0x603000001cc0,0x603000001cd4)\nallocated by thread T0 here:\n    #0 0x0001052c938c in malloc+0x78 (libclang_rt.asan_osx_dynamic.dylib:arm64e+0x3d38c)\n    #1 0x000104cc458c in main heap.c:3\n    #2 0x000185b0c270  (<unknown module>)\n\nSUMMARY: AddressSanitizer: heap-buffer-overflow heap.c:4 in main\nShadow bytes around the buggy address:\n  0x603000001a00: 00 00 fa fa 00 00 00 00 fa fa 00 00 00 00 fa fa\n  0x603000001a80: 00 00 00 00 fa fa 00 00 00 00 fa fa 00 00 00 00\n  0x603000001b00: fa fa 00 00 00 00 fa fa 00 00 00 00 fa fa 00 00\n  0x603000001b80: 00 00 fa fa 00 00 07 fa fa fa fd fd fd fa fa fa\n  0x603000001c00: fd fd fd fa fa fa fd fd fd fa fa fa 00 00 00 00\n=>0x603000001c80: fa fa 00 00 00 00 fa fa 00 00[04]fa fa fa fa fa\n  0x603000001d00: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa\n  0x603000001d80: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa\n  0x603000001e00: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa\n  0x603000001e80: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa\n  0x603000001f00: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa\nShadow byte legend (one shadow byte represents 8 application bytes):\n  Addressable:           00\n  Partially addressable: 01 02 03 04 05 06 07 \n  Heap left redzone:       fa\n  Freed heap region:       fd\n  Stack left redzone:      f1\n  Stack mid redzone:       f2\n  Stack right redzone:     f3\n  Stack after return:      f5\n  Stack use after scope:   f8\n  Global redzone:          f9\n  Global init order:       f6\n  Poisoned by user:        f7\n  Container overflow:      fc\n  Array cookie:            ac\n  Intra object redzone:    bb\n  ASan internal:           fe\n  Left alloca redzone:     ca\n  Right alloca redzone:    cb\n==72463==ABORTING\n/bin/bash: line 1: 72463 Abort trap: 6           /tmp/lode_heap\n",
  "asan-segv": "AddressSanitizer:DEADLYSIGNAL\n=================================================================\n==72473==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000000 (pc 0x0001040e0850 bp 0x00016bd1eee0 sp 0x00016bd1eeb0 T0)\n==72473==The signal is caused by a READ memory access.\n==72473==Hint: address points to the zero page.\n    #0 0x0001040e0850 in main seg.c:5\n    #1 0x000185b0c270  (<unknown module>)\n\n==72473==Register values:\n x[0] = 0x0000000000000001   x[1] = 0x000000016bd1f148   x[2] = 0x000000016bd1f158   x[3] = 0x000000016bd1f338  \n x[4] = 0x0000000000000001   x[5] = 0x0000000000000000   x[6] = 0x0000000000000000   x[7] = 0x0000000000000d20  \n x[8] = 0x0000000000000000   x[9] = 0x0000000000000000  x[10] = 0x000000016bd0ee30  x[11] = 0x000000016bd1ee80  \nx[12] = 0x00000000000011b0  x[13] = 0x000000010000c000  x[14] = 0x0000000000004000  x[15] = 0x000000000000000d  \nx[16] = 0x0000000185ebffa4  x[17] = 0x00000001f7e3efe0  x[18] = 0x0000000000000000  x[19] = 0x00000001ef560050  \nx[20] = 0x00000001ef5600a0  x[21] = 0x00000001ef560050  x[22] = 0x000000016bd1efd8  x[23] = 0x000000016bd1efd8  \nx[24] = 0x0000000185b06000  x[25] = 0x0000000000000000  x[26] = 0x0000000000000000  x[27] = 0x0000000000000000  \nx[28] = 0x0000000000000000     fp = 0x000000016bd1eee0     lr = 0x0000000185b0c274     sp = 0x000000016bd1eeb0  \nAddressSanitizer can not provide additional info.\nSUMMARY: AddressSanitizer: SEGV seg.c:5 in main\n==72473==ABORTING\n/bin/bash: line 1: 72473 Abort trap: 6           /tmp/lode_segasan\n",
  "py-aperta": "  File \"/Users/studente/lab/aperta.py\", line 1\n    print((1 + 2)\n         ^\nSyntaxError: '(' was never closed\n",
  "py-argomenti": "Traceback (most recent call last):\n  File \"/Users/studente/lab/argomenti.py\", line 3, in <module>\n    f(1)\n    ~^^^\nTypeError: f() missing 1 required positional argument: 'b'\n",
  "py-attributo": "Traceback (most recent call last):\n  File \"/Users/studente/lab/attributo.py\", line 2, in <module>\n    v.push(3)\n    ^^^^^^\nAttributeError: 'list' object has no attribute 'push'\n",
  "py-chiave": "Traceback (most recent call last):\n  File \"/Users/studente/lab/chiave.py\", line 2, in <module>\n    print(voti[\"luca\"])\n          ~~~~^^^^^^^^\nKeyError: 'luca'\n",
  "py-concat": "Traceback (most recent call last):\n  File \"/Users/studente/lab/concat.py\", line 2, in <module>\n    print(\"Hai \" + eta + \" anni\")\n          ~~~~~~~^~~~~\nTypeError: can only concatenate str (not \"int\") to str\n",
  "py-duepunti": "  File \"/Users/studente/lab/duepunti.py\", line 1\n    for i in range(3)\n                     ^\nSyntaxError: expected ':'\n",
  "py-file": "Traceback (most recent call last):\n  File \"/Users/studente/lab/file.py\", line 1, in <module>\n    f = open(\"dati.txt\")\nFileNotFoundError: [Errno 2] No such file or directory: 'dati.txt'\n",
  "py-indent": "  File \"/Users/studente/lab/indent.py\", line 2\n    print(\"si\")\n    ^^^^^\nIndentationError: expected an indented block after 'if' statement on line 1\n",
  "py-indent2": "  File \"/Users/studente/lab/indent2.py\", line 2\n    y = 2\nIndentationError: unexpected indent\n",
  "py-indice": "Traceback (most recent call last):\n  File \"/Users/studente/lab/indice.py\", line 5, in <module>\n    print(numeri[3])\n          ~~~~~~^^^\nIndexError: list index out of range\n",
  "py-input": "Traceback (most recent call last):\n  File \"/Users/studente/lab/input.py\", line 2, in <module>\n    print(nome + 1)\n          ~~~~~^~~\nTypeError: can only concatenate str (not \"int\") to str\n",
  "py-listaidx": "Traceback (most recent call last):\n  File \"/Users/studente/lab/listaidx.py\", line 2, in <module>\n    print(v[\"a\"])\n          ~^^^^^\nTypeError: list indices must be integers or slices, not str\n",
  "py-locale": "Traceback (most recent call last):\n  File \"/Users/studente/lab/locale.py\", line 4, in <module>\n    inc()\n    ~~~^^\n  File \"/Users/studente/lab/locale.py\", line 3, in inc\n    x = x + 1\n        ^\nUnboundLocalError: cannot access local variable 'x' where it is not associated with a value\n",
  "py-modulo": "Traceback (most recent call last):\n  File \"/Users/studente/lab/modulo.py\", line 1, in <module>\n    import numpyy\nModuleNotFoundError: No module named 'numpyy'\n",
  "py-nome": "Traceback (most recent call last):\n  File \"/Users/studente/lab/nome.py\", line 2, in <module>\n    print(totale)\n          ^^^^^^\nNameError: name 'totale' is not defined\n",
  "py-none": "Traceback (most recent call last):\n  File \"/Users/studente/lab/none.py\", line 2, in <module>\n    print(x.upper())\n          ^^^^^^^\nAttributeError: 'NoneType' object has no attribute 'upper'\n",
  "py-nonindicizzabile": "Traceback (most recent call last):\n  File \"/Users/studente/lab/nonindicizzabile.py\", line 2, in <module>\n    print(n[0])\n          ~^^^\nTypeError: 'int' object is not subscriptable\n",
  "py-ricorsione": "Traceback (most recent call last):\n  File \"/Users/studente/lab/ricorsione.py\", line 4, in <module>\n    f(0)\n    ~^^^\n  File \"/Users/studente/lab/ricorsione.py\", line 2, in f\n    return f(n + 1)\n  File \"/Users/studente/lab/ricorsione.py\", line 2, in f\n    return f(n + 1)\n  File \"/Users/studente/lab/ricorsione.py\", line 2, in f\n    return f(n + 1)\n  [Previous line repeated 996 more times]\nRecursionError: maximum recursion depth exceeded\n",
  "py-str": "Traceback (most recent call last):\n  File \"/Users/studente/lab/str.py\", line 2, in <module>\n    s[0] = \"C\"\n    ~^^^\nTypeError: 'str' object does not support item assignment\n",
  "py-stringa": "  File \"/Users/studente/lab/stringa.py\", line 1\n    print(\"ciao)\n          ^\nSyntaxError: unterminated string literal (detected at line 1)\n",
  "py-tab": "  File \"/Users/studente/lab/tab.py\", line 3\n    return 1\nTabError: inconsistent use of tabs and spaces in indentation\n",
  "py-ugualeif": "  File \"/Users/studente/lab/ugualeif.py\", line 1\n    if x = 5:\n       ^^^^^\nSyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?\n",
  "py-valore": "Traceback (most recent call last):\n  File \"/Users/studente/lab/valore.py\", line 1, in <module>\n    n = int(\"abc\")\nValueError: invalid literal for int() with base 10: 'abc'\n",
  "py-zero": "Traceback (most recent call last):\n  File \"/Users/studente/lab/zero.py\", line 4, in <module>\n    print(media([]))\n          ~~~~~^^^^\n  File \"/Users/studente/lab/zero.py\", line 2, in media\n    return sum(v) / len(v)\n           ~~~~~~~^~~~~~~~\nZeroDivisionError: division by zero\n",
};
const SORGENTI = {
  "pv": "#include <stdio.h>\nint main(void) {\n    int x = 5\n    printf(\"%d\\n\", x);\n    return 0;\n}\n",
  "include": "int main(void) {\n    printf(\"ciao\\n\");\n    char *p = malloc(10);\n    return 0;\n}\n",
  "assegna": "#include <stdio.h>\nint main(void) {\n    int x = 3;\n    if (x = 5) {\n        printf(\"cinque\\n\");\n    }\n    while (x = 0) { }\n    return 0;\n}\n",
  "ret": "int massimo(int a, int b) {\n    if (a > b)\n        return a;\n}\nint conta(int n) {\n    int c = n * 2;\n}\nint main(void) { return massimo(1, 2) + conta(3); }\n",
  "nondich": "#include <stdio.h>\nint main(void) {\n    int somma = 0;\n    for (int i = 0; i < 3; i++) somma += i;\n    printf(\"%d\\n\", nodo);\n    return 0;\n}\n",
  "graffa": "#include <stdio.h>\nint main(void) {\n    for (int i = 0; i < 3; i++) {\n        printf(\"%d\\n\", i);\n    return 0;\n}\n",
  "nonusata": "int main(void) {\n    int contatore;\n    int y;\n    int z = y + 1;\n    return z;\n}\n",
  "stack": "int f(int n) { return f(n + 1) + 1; }\nint main(void) { return f(0); }\n",
  "py-ugualeif": "if x = 5:\n    pass\n",
};

// ---------- uscite scritte a mano sul formato noto (da confermare sulle macchine vere) ----------
const SCRITTE = {
  // gcc 13 su Linux, LC_ALL=C
  'gcc-punto-e-virgola': "lista.c: In function 'main':\nlista.c:4:5: error: expected ';' before 'printf'\n    4 |     printf(\"%d\\n\", x);\n      |     ^~~~~~\n",
  'gcc-non-dichiarato': "lista.c: In function 'inserisci':\nlista.c:42:12: error: 'nodo' undeclared (first use in this function)\n   42 |     return nodo;\n      |            ^~~~\nlista.c:42:12: note: each undeclared identifier is reported only once for each function it appears in\n",
  'gcc-include': "main.c: In function 'main':\nmain.c:2:5: warning: implicit declaration of function 'printf' [-Wimplicit-function-declaration]\n    2 |     printf(\"ciao\\n\");\n      |     ^~~~~~\nmain.c:1:1: note: include '<stdio.h>' or provide a declaration of 'printf'\n  +++ |+#include <stdio.h>\n    1 | int main(void) {\nmain.c:2:5: warning: incompatible implicit declaration of built-in function 'printf' [-Wbuiltin-declaration-mismatch]\n",
  'gcc-return': "ret.c: In function 'massimo':\nret.c:4:1: warning: control reaches end of non-void function [-Wreturn-type]\n    4 | }\n      | ^\n",
  'gcc-uguale': "assegna.c: In function 'main':\nassegna.c:4:9: warning: suggest parentheses around assignment used as truth value [-Wparentheses]\n    4 |     if (x = 5) {\n      |         ^\n",
  'gcc-formato': "media.c:6:14: warning: format '%d' expects argument of type 'int', but argument 2 has type 'double' [-Wformat=]\n",
  'gcc-scanf': "leggi.c:4:13: warning: format '%d' expects argument of type 'int *', but argument 2 has type 'int' [-Wformat=]\n",
  'gcc-fine-file': "lista.c: In function 'main':\nlista.c:20:1: error: expected declaration or statement at end of input\n   20 | }\n      | ^\n",
  'gcc-header': "main.c:1:10: fatal error: stdoi.h: No such file or directory\n    1 | #include <stdoi.h>\n      |          ^~~~~~~~~\ncompilation terminated.\n",
  'gcc-freccia': "lista.c:12:10: error: 'p' is a pointer; did you mean to use '->'?\n",
  'gcc-membro': "lista.c:13:10: error: 'struct nodo' has no member named 'valore'\n",
  'gcc-array': "nomi.c:5:10: error: assignment to expression with array type\n",
  'gcc-utf8': "lista.c: In function ‘main’:\nlista.c:42:12: error: ‘nodo’ undeclared (first use in this function)\n",
  'gcc-linker': "/usr/bin/ld: /tmp/ccQ5Xb2a.o: in function `main':\nmain.c:(.text+0xe): undefined reference to `calcola'\ncollect2: error: ld returned 1 exit status\n",
  'gcc-linker-g': "/usr/bin/ld: /tmp/ccQ5Xb2a.o: in function `main':\n/home/anna/lab3/main.c:3:(.text+0xe): undefined reference to `calcola'\ncollect2: error: ld returned 1 exit status\n",
  'gcc-lm': "/usr/bin/ld: /tmp/cc1.o: in function `main':\nm.c:(.text+0x2a): undefined reference to `sqrt'\ncollect2: error: ld returned 1 exit status\n",
  'gcc-doppio': "/usr/bin/ld: /tmp/ccB.o:(.bss+0x0): multiple definition of `conta'; /tmp/ccA.o:(.bss+0x0): first defined here\ncollect2: error: ld returned 1 exit status\n",
  'gcc-senza-main': "/usr/bin/ld: /usr/lib/gcc/x86_64-linux-gnu/13/../../../x86_64-linux-gnu/Scrt1.o: in function `_start':\n(.text+0x1b): undefined reference to `main'\ncollect2: error: ld returned 1 exit status\n",
  'gcc-file-mancante': "gcc: error: lista.c: No such file or directory\ngcc: fatal error: no input files\ncompilation terminated.\n",
  // MinGW su Windows (MSYS2 UCRT64)
  'mingw-errore': "C:\\Users\\anna\\lab3\\lista.c: In function 'main':\nC:\\Users\\anna\\lab3\\lista.c:42:12: error: 'nodo' undeclared (first use in this function)\n",
  'mingw-linker': "C:/msys64/ucrt64/bin/../lib/gcc/x86_64-w64-mingw32/14.2.0/../../../../x86_64-w64-mingw32/bin/ld.exe: C:\\Users\\anna\\AppData\\Local\\Temp\\ccmlgXyz.o:main.c:(.text+0x1e): undefined reference to `calcola'\ncollect2.exe: error: ld returned 1 exit status\n",
  'mingw-winmain': "C:/msys64/ucrt64/bin/../lib/gcc/x86_64-w64-mingw32/14.2.0/../../../../x86_64-w64-mingw32/bin/ld.exe: C:/msys64/ucrt64/lib/libmingw32.a(lib64_libmingw32_a-crtexewin.o): in function `main':\nC:/M/B/src/mingw-w64/mingw-w64-crt/crt/crtexewin.c:67:(.text.startup+0xc5): undefined reference to `WinMain'\ncollect2.exe: error: ld returned 1 exit status\n",
  // gcc in italiano (LANG=it_IT.UTF-8): testo ricostruito dalle traduzioni, da verificare
  'gcc-it-non-dichiarato': "lista.c: Nella funzione «main»:\nlista.c:42:12: errore: «nodo» non dichiarato (primo utilizzo in questa funzione)\nlista.c:42:12: nota: ogni identificatore non dichiarato è riportato solo una volta per ogni funzione in cui appare\n",
  'gcc-it-implicita': "main.c:2:5: avviso: dichiarazione implicita della funzione «printf» [-Wimplicit-function-declaration]\n",
  'gcc-it-return': "ret.c:4:1: avviso: il controllo raggiunge la fine di una funzione non void [-Wreturn-type]\n",
  'gcc-it-punto': "lista.c:4:5: errore: atteso «;» prima di «printf»\n",
  // MSVC (cl.exe) e il suo linker
  'msvc-non-dichiarato': "lista.c(42): error C2065: 'nodo': undeclared identifier\n",
  'msvc-punto-e-virgola': "main.c(4): error C2143: syntax error: missing ';' before 'return'\n",
  'msvc-include': "main.c(2): warning C4013: 'printf' undefined; assuming extern returning int\n",
  'msvc-return': "ret.c(4): warning C4715: 'massimo': not all control paths return a value\n",
  'msvc-scanf': "main.c(5,5): warning C4996: 'scanf': This function or variable may be unsafe. Consider using scanf_s instead. To disable deprecation, use _CRT_SECURE_NO_WARNINGS. See online help for details.\n",
  'msvc-italiano': "lista.c(42): error C2065: 'nodo': identificatore non dichiarato\n",
  'msvc-linker': "main.obj : error LNK2019: unresolved external symbol calcola referenced in function main\nmain.exe : fatal error LNK1120: 1 unresolved externals\n",
  // javac e Java
  'javac': "Main.java:5: error: ';' expected\n        int x = 5\n                 ^\nMain.java:7: error: cannot find symbol\n        System.out.println(y);\n                           ^\n  symbol:   variable y\n  location: class Main\n2 errors\n",
  'javac-scanner': "Main.java:3: error: cannot find symbol\n        Scanner in = new Scanner(System.in);\n        ^\n  symbol:   class Scanner\n  location: class Main\n",
  'javac-tipi': "Main.java:6: error: incompatible types: possible lossy conversion from double to int\n        int m = somma / 2.0;\n                      ^\n",
  'java-indice': "Exception in thread \"main\" java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 5\n\tat Main.main(Main.java:6)\n",
  'java-input': "Exception in thread \"main\" java.util.InputMismatchException\n\tat java.base/java.util.Scanner.throwFor(Scanner.java:947)\n\tat java.base/java.util.Scanner.next(Scanner.java:1602)\n\tat java.base/java.util.Scanner.nextInt(Scanner.java:2267)\n\tat java.base/java.util.Scanner.nextInt(Scanner.java:2221)\n\tat Main.main(Main.java:8)\n",
  // crash su Linux e Windows
  'linux-segfault': "Segmentation fault (core dumped)\n",
  'linux-segfault-it': "Errore di segmentazione (core dump creato)\n",
  'linux-fpe': "Floating point exception (core dumped)\n",
  'linux-double-free': "free(): double free detected in tcache 2\nAborted (core dumped)\n",
  'linux-assert': "a.out: lista.c:31: conta: Assertion `n >= 0' failed.\nAborted (core dumped)\n",
  'make-139': "make: *** [Makefile:5: test] Error 139\n",
  'codeblocks': "\nProcess returned -1073741819 (0xC0000005)   execution time : 1.875 s\nPress any key to continue.\n",
  'devcpp': "--------------------------------\nProcess exited after 2.41 seconds with return value 3221225725\nPremere un tasto per continuare . . .\n",
  'windows-zero': "Il programma '[4321] lab3.exe' è terminato con il codice 3221225620 (0xc0000094).\n",
  'ubsan': "lista.c:17:14: runtime error: division by zero\n",
  'ubsan-indice': "vett.c:9:5: runtime error: index 5 out of bounds for type 'int[5]'\n",
  // Code::Blocks (scheda «Build messages», copiata) e Dev-C++ (scheda «Compiler», copiata): colonne separate da | e da tab
  'codeblocks-messaggi': "||=== Build: Debug in lab3 (compiler: GNU GCC Compiler) ===|\nC:\\Users\\anna\\lab3\\main.c||In function 'main':|\nC:\\Users\\anna\\lab3\\main.c|6|error: 'nodo' undeclared (first use in this function)|\nC:\\Users\\anna\\lab3\\main.c|6|note: each undeclared identifier is reported only once for each function it appears in|\n||=== Build failed: 1 error(s), 0 warning(s) (0 minute(s), 0 second(s)) ===|\n",
  'codeblocks-linker': "||=== Build: Debug in lab3 (compiler: GNU GCC Compiler) ===|\nobj\\Debug\\main.o||In function `main':|\nC:\\Users\\anna\\lab3\\main.c|3|undefined reference to `calcola'|\n||error: ld returned 1 exit status|\n||=== Build failed: 2 error(s), 0 warning(s) (0 minute(s), 1 second(s)) ===|\n",
  'devcpp-messaggi': "\t\tC:\\Users\\anna\\lab3\\main.c\tIn function 'main':\n6\t2\tC:\\Users\\anna\\lab3\\main.c\t[Error] 'nodo' undeclared (first use in this function)\n6\t2\tC:\\Users\\anna\\lab3\\main.c\t[Note] each undeclared identifier is reported only once for each function it appears in\n",
  'devcpp-avviso': "\t\tC:\\Users\\anna\\lab3\\main.c\tIn function 'main':\n4\t9\tC:\\Users\\anna\\lab3\\main.c\t[Warning] suggest parentheses around assignment used as truth value [-Wparentheses]\n",
  // colori del terminale (clang -fcolor-diagnostics) e CRLF di Windows
  'colori': "\x1b[1mpv.c:3:14: \x1b[0m\x1b[0;1;31merror: \x1b[0m\x1b[1mexpected ';' at end of declaration\x1b[0m\r\n    3 |     int x = 5\r\n",
};

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const primo = t => E.riassunto(E.analizza(t)).primo;
const vedi = d => d ? JSON.stringify({ chiave: d.chiave, file: d.file, riga: d.riga, colonna: d.colonna, tipo: d.tipo, nome: d.nome, parti: d.parti }) : 'nessun errore';
// controlla il primo errore di un'uscita: chiave, riga e quello che si chiede in più
function atteso(nome, testo, att) {
  const d = primo(testo);
  const giusto = d && Object.entries(att).every(([k, v]) => k === 'parti' ? Object.entries(v).every(([pk, pv]) => d.parti[pk] === pv) : k === 'file' ? E.nomeFile(d.file) === v : d[k] === v);
  prova(nome, giusto, vedi(d));
  return d;
}
const testi = sp => [sp.intestazione, sp.frase, ...sp.passi.map(p => p.testo + (p.righe || []).map(r => r.testo).join('\n'))].join('\n');

// ---------- clang: uscite vere ----------
const CLANG = {
  pv: { chiave: 'punto-e-virgola', riga: 3, colonna: 14 }, nondich: { chiave: 'non-dichiarato', riga: 5, nome: 'nodo' },
  include: { chiave: 'include-mancante', riga: 2, nome: 'printf', parti: { h: 'stdio.h' } }, implicita: { chiave: 'funzione-non-dichiarata', riga: 3, nome: 'calcola' },
  formato: { chiave: 'formato', riga: 4, tipo: 'avviso' }, scanf: { chiave: 'scanf-e-commerciale', riga: 4 }, ret: { chiave: 'return-mancante', riga: 4 },
  assegna: { chiave: 'assegnamento-in-condizione', riga: 4, colonna: 11 }, puntint: { chiave: 'puntatore-intero', riga: 5 }, incomp: { chiave: 'intero-puntatore', riga: 8 },
  nonusata: { chiave: 'variabile-non-usata', riga: 2, nome: 'contatore' }, graffa: { chiave: 'graffa', riga: 6, parti: { aperta: 2 } },
  parentesi: { chiave: 'parentesi', riga: 3, parti: { aperta: 3 } }, argomenti: { chiave: 'argomenti', riga: 3, nome: 'somma' },
  conflitto: { chiave: 'tipi-in-conflitto', riga: 2, nome: 'doppio', parti: { prima: 1 } }, ridef: { chiave: 'ridefinizione', riga: 3, nome: 'x', parti: { prima: 2 } },
  indice: { chiave: 'non-array', riga: 5 }, freccia: { chiave: 'freccia-punto', riga: 5, parti: { usa: '->' } }, header: { chiave: 'header-non-trovato', riga: 1, parti: { h: 'stdoi.h' } },
  assegnabile: { chiave: 'non-assegnabile', riga: 4 }, tipo: { chiave: 'include-mancante', riga: 2, nome: 'bool', parti: { h: 'stdbool.h' } },
  virgolette: { chiave: 'virgolette', riga: 3 }, operandi: { chiave: 'operandi', riga: 4 }, vuoto: { chiave: 'if-vuoto', riga: 3 }, locale: { chiave: 'indirizzo-locale', riga: 3, nome: 'v' },
  segni: { chiave: 'segni-diversi', riga: 5 }, voidret: { chiave: 'return-void', riga: 1 }, mainvoid: { chiave: 'main-int', riga: 1 }, divzero: { chiave: 'divisione-zero', riga: 1 },
  ecc: { chiave: 'troppi-inizializzatori', riga: 1 }, printfarg: { chiave: 'argomenti-formato', riga: 2 }, espr: { chiave: 'espressione-attesa', riga: 2 }, stack: { chiave: 'ricorsione-infinita', riga: 1 },
  'linker-mancante': { chiave: 'riferimento-non-definito', tipo: 'linker', nome: 'calcola' }, 'linker-doppio': { chiave: 'definizione-multipla', tipo: 'linker', nome: 'conta' },
  'linker-senza-main': { chiave: 'riferimento-non-definito', nome: 'main', parti: { main: true } },
  'segfault-bash': { chiave: 'esec-memoria', tipo: 'esecuzione' }, 'assert-mac': { chiave: 'esec-asserzione', file: 'ass.c', riga: 4, parti: { cond: 'x == 4' } },
  'double-free-bash': { chiave: 'esec-abort' }, 'asan-heap': { chiave: 'esec-fuori-array', file: 'heap.c', riga: 4 }, 'asan-segv': { chiave: 'esec-memoria', file: 'seg.c', riga: 5 },
};
for (const [k, att] of Object.entries(CLANG)) atteso(`clang ${k}`, VERE[k], att);
prova('clang: tutte le uscite vere hanno almeno un errore riconosciuto', Object.keys(VERE).every(k => E.analizza(VERE[k]).some(d => d.chiave)), Object.keys(VERE).filter(k => !E.analizza(VERE[k]).some(d => d.chiave)).join(', '));
prova('clang: tipo string → tipo sconosciuto', E.analizza(VERE.tipo).some(d => d.chiave === 'tipo-sconosciuto' && d.nome === 'string'));
prova('clang: secondo include (malloc → stdlib.h)', E.analizza(VERE.include).some(d => d.nome === 'malloc' && d.parti.h === 'stdlib.h'));
prova('clang: un solo errore per assert + abort', E.analizza(VERE['assert-mac']).length === 1, E.analizza(VERE['assert-mac']).map(vedi).join(' '));
prova('clang: ASan dice scrittura e puntatore NULL', E.analizza(VERE['asan-heap'])[0]?.dettagli.accesso === 'scrittura' && E.analizza(VERE['asan-segv'])[0]?.dettagli.nullo === true);
prova('clang: il codice mostrato dal compilatore resta per l\'estratto', primo(VERE.nondich).righeUscita[5] === '    printf("%d\\n", nodo);');
prova('riassunto: «e un altro errore e 1 avviso»', E.riassunto(E.analizza(VERE.include)).conto === 'e un altro errore e 1 avviso', E.riassunto(E.analizza(VERE.include)).conto);

// ---------- Python: uscite vere ----------
const PY = {
  'py-aperta': { chiave: 'py-parentesi', riga: 1, tipo: 'errore' }, 'py-argomenti': { chiave: 'py-tipo-argomenti', riga: 3 }, 'py-attributo': { chiave: 'py-attributo', riga: 2 },
  'py-chiave': { chiave: 'py-chiave', riga: 2 }, 'py-concat': { chiave: 'py-tipo-concatena', riga: 2, tipo: 'esecuzione' }, 'py-duepunti': { chiave: 'py-due-punti', riga: 1 },
  'py-file': { chiave: 'py-file', riga: 1 }, 'py-indent': { chiave: 'py-indentazione', riga: 2 }, 'py-indent2': { chiave: 'py-indentazione', riga: 2 },
  'py-indice': { chiave: 'py-indice', riga: 5, file: 'indice.py', eccezione: 'IndexError' }, 'py-input': { chiave: 'py-tipo-concatena', riga: 2 }, 'py-listaidx': { chiave: 'py-tipo-indice', riga: 2 },
  'py-locale': { chiave: 'py-locale', riga: 3, nome: 'x' }, 'py-modulo': { chiave: 'py-modulo', riga: 1 }, 'py-nome': { chiave: 'py-nome', riga: 2, nome: 'totale' },
  'py-none': { chiave: 'py-attributo', riga: 2, parti: { t: 'NoneType' } }, 'py-nonindicizzabile': { chiave: 'py-tipo-indice', riga: 2 }, 'py-ricorsione': { chiave: 'py-ricorsione', riga: 2 },
  'py-str': { chiave: 'py-tipo-indice', riga: 2 }, 'py-stringa': { chiave: 'py-stringa', riga: 1 }, 'py-tab': { chiave: 'py-indentazione', riga: 3 },
  'py-ugualeif': { chiave: 'py-uguale', riga: 1 }, 'py-valore': { chiave: 'py-valore', riga: 1 }, 'py-zero': { chiave: 'py-divisione-zero', riga: 2, funzione: 'media' },
};
for (const [k, att] of Object.entries(PY)) atteso(`python ${k}`, VERE[k], att);
prova('python: la pila delle chiamate', primo(VERE['py-zero']).pila.length === 2);
let sp = E.spiega(primo(VERE['py-indice']));
prova('python: «indice.py, riga 5 · IndexError: stai leggendo una posizione che la lista non ha»', sp.intestazione === '**indice.py, riga 5** · IndexError: stai leggendo una posizione che la lista non ha', sp.intestazione);
prova('python: senza file si usa la riga mostrata da Python', sp.estratto?.righe[0]?.testo === 'print(numeri[3])', JSON.stringify(sp.estratto));
sp = E.spiega(primo(VERE['py-zero']));
prova('python: «ci sei arrivato così»', /riga 4 \(`<module>`\) → riga 2 \(`media`\)/.test(sp.passi[0].testo), sp.passi[0].testo);
sp = E.spiega(primo(VERE['py-ugualeif']), { sorgente: SORGENTI['py-ugualeif'] });
prova('python: correzione di = in ==', sp.passi[2]?.righe?.[1]?.testo === 'if x == 5:', JSON.stringify(sp.passi[2]));

// ---------- formati scritti a mano ----------
const SCR = {
  'gcc-punto-e-virgola': { chiave: 'punto-e-virgola', riga: 4, funzione: 'main' }, 'gcc-non-dichiarato': { chiave: 'non-dichiarato', riga: 42, nome: 'nodo' },
  'gcc-include': { chiave: 'include-mancante', nome: 'printf', parti: { h: 'stdio.h' } }, 'gcc-return': { chiave: 'return-mancante', funzione: 'massimo' },
  'gcc-uguale': { chiave: 'assegnamento-in-condizione', riga: 4 }, 'gcc-formato': { chiave: 'formato', parti: { atteso: 'int', dato: 'double' } }, 'gcc-scanf': { chiave: 'scanf-e-commerciale' },
  'gcc-fine-file': { chiave: 'graffa', riga: 20 }, 'gcc-header': { chiave: 'header-non-trovato', parti: { h: 'stdoi.h' } }, 'gcc-freccia': { chiave: 'freccia-punto', parti: { usa: '->' } },
  'gcc-membro': { chiave: 'membro-inesistente', parti: { m: 'valore', t: 'struct nodo' } }, 'gcc-array': { chiave: 'non-assegnabile' }, 'gcc-utf8': { chiave: 'non-dichiarato', nome: 'nodo', funzione: 'main' },
  'gcc-linker': { chiave: 'riferimento-non-definito', nome: 'calcola', file: 'main.c', tipo: 'linker' }, 'gcc-linker-g': { chiave: 'riferimento-non-definito', file: 'main.c', riga: 3 },
  'gcc-lm': { chiave: 'riferimento-non-definito', nome: 'sqrt', parti: { h: 'math.h' } }, 'gcc-doppio': { chiave: 'definizione-multipla', nome: 'conta' },
  'gcc-senza-main': { chiave: 'riferimento-non-definito', nome: 'main', file: null, riga: null }, 'gcc-file-mancante': { chiave: 'file-sorgente-mancante' },
  'mingw-errore': { chiave: 'non-dichiarato', file: 'lista.c', riga: 42 }, 'mingw-linker': { chiave: 'riferimento-non-definito', nome: 'calcola', file: 'main.c' },
  'mingw-winmain': { chiave: 'riferimento-non-definito', nome: 'WinMain', file: null, parti: { main: true } },
  'gcc-it-non-dichiarato': { chiave: 'non-dichiarato', nome: 'nodo', riga: 42, funzione: 'main' }, 'gcc-it-implicita': { chiave: 'include-mancante', nome: 'printf', parti: { h: 'stdio.h' } },
  'gcc-it-return': { chiave: 'return-mancante', riga: 4 }, 'gcc-it-punto': { chiave: 'punto-e-virgola', riga: 4 },
  'msvc-non-dichiarato': { chiave: 'non-dichiarato', nome: 'nodo', riga: 42, sigla: 'C2065' }, 'msvc-punto-e-virgola': { chiave: 'punto-e-virgola', riga: 4 },
  'msvc-include': { chiave: 'include-mancante', nome: 'printf', parti: { h: 'stdio.h' } }, 'msvc-return': { chiave: 'return-mancante', nome: 'massimo' },
  'msvc-scanf': { chiave: 'non-sicura', nome: 'scanf', colonna: 5 }, 'msvc-italiano': { chiave: 'non-dichiarato', nome: 'nodo' }, 'msvc-linker': { chiave: 'riferimento-non-definito', nome: 'calcola' },
  'javac': { chiave: 'punto-e-virgola', riga: 5, colonna: 18, linguaggio: 'java' }, 'javac-scanner': { chiave: 'java-import', nome: 'Scanner' },
  'javac-tipi': { chiave: 'java-tipi', parti: { dato: 'double', atteso: 'int' } }, 'java-indice': { chiave: 'java-indice', file: 'Main.java', riga: 6, parti: { i: '5', l: '5' } },
  'java-input': { chiave: 'java-input', file: 'Main.java', riga: 8 },
  'linux-segfault': { chiave: 'esec-memoria' }, 'linux-segfault-it': { chiave: 'esec-memoria' }, 'linux-fpe': { chiave: 'esec-divisione-zero' },
  'linux-double-free': { chiave: 'esec-heap' }, 'linux-assert': { chiave: 'esec-asserzione', file: 'lista.c', riga: 31, parti: { cond: 'n >= 0' } }, 'make-139': { chiave: 'esec-memoria' },
  'codeblocks': { chiave: 'esec-memoria', codiceUscita: '0xC0000005' }, 'devcpp': { chiave: 'esec-stack' }, 'windows-zero': { chiave: 'esec-divisione-zero' },
  'codeblocks-messaggi': { chiave: 'non-dichiarato', riga: 6, file: 'main.c', nome: 'nodo', funzione: 'main', tipo: 'errore' }, 'codeblocks-linker': { chiave: 'riferimento-non-definito', nome: 'calcola', riga: 3 },
  'devcpp-messaggi': { chiave: 'non-dichiarato', riga: 6, colonna: 2, file: 'main.c', nome: 'nodo', funzione: 'main' }, 'devcpp-avviso': { chiave: 'assegnamento-in-condizione', riga: 4, tipo: 'avviso' },
  'ubsan': { chiave: 'esec-divisione-zero', riga: 17, tipo: 'esecuzione' }, 'ubsan-indice': { chiave: 'esec-fuori-array', riga: 9 }, 'colori': { chiave: 'punto-e-virgola', riga: 3 },
};
for (const [k, att] of Object.entries(SCR)) atteso(`formato ${k}`, SCRITTE[k], att);
prova('javac: il secondo errore ha il nome dal «symbol»', E.analizza(SCRITTE.javac)[1]?.nome === 'y' && E.analizza(SCRITTE.javac)[1]?.chiave === 'non-dichiarato');
prova('linux: double free e Aborted sono un errore solo', E.analizza(SCRITTE['linux-double-free']).length === 1);
prova('testo che non è un errore → lista vuota', E.analizza('Ciao, oggi ho studiato i puntatori.\nProcess returned 0 (0x0)\nmake: *** [Makefile:3: test] Error 1\n').length === 0);
prova('testo vuoto o mancante → lista vuota', E.analizza('').length === 0 && E.analizza(null).length === 0 && E.analizza(undefined).length === 0);
prova('doppioni saltati', E.analizza(SCRITTE['gcc-non-dichiarato'] + SCRITTE['gcc-non-dichiarato']).length === 1);
prova('errore sconosciuto: chiave null', primo('main.c:3:5: error: something completely new happened\n')?.chiave === null);

// ---------- analizzaUscita: esito di una prova senza shell ----------
const U = o => E.analizzaUscita(o).map(d => d.chiave).join(',');
prova('uscita: SIGSEGV', U({ segnale: 'SIGSEGV' }) === 'esec-memoria');
prova('uscita: Windows 3221225477', U({ codice: 3221225477 }) === 'esec-memoria');
prova('uscita: Windows -1073741676', U({ codice: -1073741676 }) === 'esec-divisione-zero');
prova('uscita: Windows stack overflow', U({ codice: 3221225725 }) === 'esec-stack');
prova('uscita: shell 139', U({ codice: 139 }) === 'esec-memoria');
prova('uscita: tempo scaduto', U({ tempoScaduto: true, segnale: 'SIGKILL' }) === 'esec-tempo');
prova('uscita: return 1 normale non è un crash', U({ codice: 1, stderr: '' }) === '');
prova('uscita: traceback Python nello stderr', U({ codice: 1, stderr: VERE['py-zero'] }) === 'py-divisione-zero');
prova('uscita: ASan nello stderr vince sul segnale', U({ segnale: 'SIGABRT', stderr: VERE['asan-heap'] }) === 'esec-fuori-array');

// ---------- spiega: i tre passi ----------
sp = E.spiega(primo(VERE.pv), { sorgente: SORGENTI.pv });
prova('spiega ;: intestazione', sp.intestazione === '**pv.c, riga 3**: manca un `;`', sp.intestazione);
prova('spiega ;: tre passi in ordine', sp.passi.map(p => p.id).join() === 'dove,cosa,correzione' && sp.passi[2].titolo === 'Fammi vedere la correzione');
prova('spiega ;: correzione sulla riga vera', sp.passi[2].righe[1].testo === '    int x = 5;' && sp.passi[2].righe[1].segno === '+', JSON.stringify(sp.passi[2]));
prova('spiega ;: estratto riga ±2', sp.estratto.da === 1 && sp.estratto.a === 5 && sp.estratto.righe.find(r => r.qui).n === 3);
prova('spiega: «valutato» toglie la correzione', E.spiega(primo(VERE.pv), { sorgente: SORGENTI.pv, valutato: true }).passi.length === 2);
prova('spiega: file cambiato → avviso sui numeri di riga', /numeri di riga/.test(E.spiega(primo(VERE.pv), { cambiato: true }).avviso));
// gcc vecchio: «expected ';' before 'printf'» segnalato sulla riga dopo → la correzione va sulla riga prima
sp = E.spiega(primo(SCRITTE['gcc-punto-e-virgola']), { sorgente: '#include <stdio.h>\nint main(void) {\n    int x = 5\n    printf("%d\\n", x);\n    return 0;\n}\n' });
prova('spiega ; (gcc): correzione sulla riga prima', sp.passi[2]?.righe?.[1]?.n === 3 && sp.passi[2].righe[1].testo === '    int x = 5;' && /riga 3/.test(sp.passi[0].testo), JSON.stringify(sp.passi));
sp = E.spiega(primo('m.c:2:20: error: expected \';\' after expression\n'), { sorgente: 'int main(void) {\n    int x = 1 // uno\n}\n' });
prova('spiega ;: il commento in fondo resta dopo il ;', sp.passi[2]?.righe?.[1]?.testo === '    int x = 1; // uno', JSON.stringify(sp.passi[2]));
sp = E.spiega(primo(VERE.include), { sorgente: SORGENTI.include });
prova('spiega include: #include <stdio.h> in cima', sp.passi[2]?.righe?.[0]?.testo === '#include <stdio.h>' && sp.passi[2].righe[0].n === 1, JSON.stringify(sp.passi[2]));
sp = E.spiega(primo(VERE.include), { sorgente: '#include <string.h>\n' + SORGENTI.include });
prova('spiega include: dopo l\'ultimo #include', sp.passi[2]?.righe?.[1]?.n === 2 && sp.passi[2].righe[1].testo === '#include <stdio.h>', JSON.stringify(sp.passi[2]));
sp = E.spiega(primo(VERE.assegna), { sorgente: SORGENTI.assegna });
prova('spiega = in if: correzione', sp.passi[2]?.righe?.[1]?.testo === '    if (x == 5) {', JSON.stringify(sp.passi[2]));
sp = E.spiega(primo(SCRITTE['gcc-uguale']), { sorgente: SORGENTI.assegna });
prova('spiega = in if (gcc, colonna sulla x)', sp.passi[2]?.righe?.[1]?.testo === '    if (x == 5) {', JSON.stringify(sp.passi[2]));
sp = E.spiega(primo(VERE.ret), { sorgente: SORGENTI.ret });
prova('spiega return: nome della funzione e return ‹valore›', /`massimo`/.test(sp.intestazione) && sp.passi[2]?.righe?.some(r => r.segno === '+' && r.testo === '    return ‹valore›;'), JSON.stringify(sp));
prova('spiega return: nessun valore inventato', !/return 0;|return a;|return -1;/.test(sp.passi[2].righe.filter(r => r.segno === '+').map(r => r.testo).join()));
sp = E.spiega(primo(VERE.nondich), { sorgente: SORGENTI.nondich });
prova('spiega non dichiarato: testo della spec', sp.intestazione === '**nondich.c, riga 5**: usi `nodo` ma non è dichiarato' && sp.passi[0].testo.startsWith('Cerca dove dichiari `nodo`: forse ha un altro nome'), sp.intestazione);
prova('spiega non dichiarato: niente correzione (non è meccanica)', sp.passi.length === 2);
sp = E.spiega(primo(VERE.graffa));
prova('spiega graffa: dice dove si apre', /riga 2/.test(sp.passi[0].testo), sp.passi[0].testo);
sp = E.spiega(primo(VERE.header));
prova('spiega header: «forse volevi stdio.h»', /stdio\.h/.test(sp.passi[0].testo), sp.passi[0].testo);
sp = E.spiega(primo(SCRITTE['linux-segfault']), { righeCambiate: [{ file: 'lista.c', da: 30, a: 52 }] });
prova('spiega segfault: frase della spec e righe cambiate', /memoria che non è sua/.test(sp.intestazione) && /lista\.c 30-52/.test(sp.passi[0].testo) && /puntatore `NULL`/.test(sp.passi[1].testo), testi(sp));
sp = E.spiega(primo(VERE['asan-segv']));
prova('spiega ASan: riga e NULL', /riga 5 di `seg\.c`/.test(sp.passi[0].testo) && /valeva `NULL`/.test(sp.passi[1].testo), testi(sp));
sp = E.spiega(primo('main.c:3:5: error: something completely new happened\n'));
prova('spiega sconosciuto: lo dice e non inventa', !sp.conosciuto && /non lo conosco ancora/.test(sp.intestazione) && /Lode non ha ancora una spiegazione/.test(sp.passi[1].testo) && sp.passi.length === 2 && sp.originale === 'something completely new happened');
sp = E.spiega(primo('Traceback (most recent call last):\n  File "a.py", line 3, in <module>\n    x = f()\nOverflowError: math range error\n'));
prova('spiega Python sconosciuto', !sp.conosciuto && sp.intestazione.startsWith('**a.py, riga 3** · OverflowError:') && /`OverflowError`/.test(sp.passi[1].testo), testi(sp));
sp = E.spiega(primo(VERE['linker-senza-main']));
prova('spiega senza main', /manca la funzione `main`/i.test(sp.intestazione) && sp.luogo === null, testi(sp));
prova('perDiario: «lista.c:42 «nodo non dichiarato»»', E.perDiario(primo(SCRITTE['gcc-non-dichiarato'])) === 'lista.c:42 «nodo non dichiarato»', E.perDiario(primo(SCRITTE['gcc-non-dichiarato'])));
prova('nomeErrore per il registro', E.nomeErrore('punto-e-virgola') === 'manca `;`' && E.nomeErrore('niente') === 'errore sconosciuto');
// progetto:righe ({ righe: [{ n, s }] }) va bene come sorgente
sp = E.spiega(primo(VERE.pv), { sorgente: { rel: 'pv.c', da: 1, a: 5, righe: SORGENTI.pv.split('\n').slice(0, 5).map((s, i) => ({ n: i + 1, s })) } });
prova('spiega: sorgente da progetto:righe', sp.estratto?.daFile && sp.passi[2]?.righe?.[1]?.testo === '    int x = 5;');
prova('righeCambiateDa: dal diff di F2', JSON.stringify(E.righeCambiateDa({ rel: 'lista.c', blocchi: [{ righe: [{ t: ' ', nb: 29 }, { t: '+', nb: 30 }, { t: '+', nb: 31 }, { t: '-' }, { t: '+', nb: 32 }, { t: ' ', nb: 33 }, { t: '+', nb: 40 }] }] })) === '[{"file":"lista.c","da":30,"a":32},{"file":"lista.c","da":40,"a":40}]');

// ---------- il dizionario ----------
const V = E.CHIAVI.map(E.voce);
prova('almeno 25 voci per il C (compilatore e linker)', V.filter(v => v.lingue.includes('c') && !v.id.startsWith('esec-')).length >= 25, V.filter(v => v.lingue.includes('c')).length);
prova('almeno 10 voci per Python', V.filter(v => v.id.startsWith('py-')).length >= 10);
prova('correzione solo per i casi meccanici (;, #include, =, return)', V.filter(v => v.meccanica).map(v => v.id).sort().join() === 'assegnamento-in-condizione,include-mancante,punto-e-virgola,py-uguale,return-mancante', V.filter(v => v.meccanica).map(v => v.id).join());
// ogni voce funziona anche senza dati (niente nome, niente riga, niente file): mai «undefined» o «null» nel testo
const rotte = [];
for (const v of V) for (const riga of [null, 7]) {
  const d = { chiave: v.id, linguaggio: v.lingue[0], tipo: v.id.startsWith('esec-') ? 'esecuzione' : 'errore', messaggio: 'x', file: riga ? 'a.c' : null, riga, colonna: null, nome: null, note: [], righeUscita: {}, dettagli: {}, parti: {} };
  try { const t = testi(E.spiega(d)); const re = /undefined|(?<!`)null(?!`)|NaN|\[object/; if (re.test(t)) rotte.push(`${v.id}: ${t.match(new RegExp('.{0,30}(' + re.source + ').{0,10}'))[0]}`); } catch (e) { rotte.push(`${v.id}: ${e.message}`); }
}
prova('ogni voce regge senza dati', !rotte.length, rotte.join(' | '));
prova('testi in italiano, frasi brevi', V.every(v => v.etichetta && v.concetto));

// ---------- HTML ----------
prova('html: escape e `codice`', E.html('a <b> `x<y` **z**') === 'a &lt;b&gt; <code>x&lt;y</code> <b>z</b>', E.html('a <b> `x<y` **z**'));
let h = E.schedaHtml(E.spiega(primo(VERE.pv), { sorgente: SORGENTI.pv }), { conto: 'e 2 avvisi' });
prova('schedaHtml: passi, estratto e conto', h.includes('data-passo="correzione"') && h.includes('class="ld-err-r qui"') && h.includes('e 2 avvisi') && h.includes('<b>pv.c, riga 3</b>'));
prova('schedaHtml: «correzione vista»', E.schedaHtml(E.spiega(primo(VERE.pv)), { vista: true }).includes('correzione vista'));
prova('schedaHtml: valutato senza correzione', !E.schedaHtml(E.spiega(primo(VERE.pv), { valutato: true })).includes('data-passo="correzione"'));
prova('schedaHtml: niente HTML dal messaggio', !E.schedaHtml(E.spiega(primo('a.c:1:1: error: <img src=x onerror=alert(1)>\n'))).includes('<img'));
// ---------- le correzioni dei revisori ----------
prova('Code::Blocks e Dev-C++: un errore solo, le righe di contorno no', E.analizza(SCRITTE['codeblocks-messaggi']).length === 1 && E.analizza(SCRITTE['devcpp-messaggi']).length === 1 && E.analizza(SCRITTE['codeblocks-linker']).length === 1);
prova('Code::Blocks: le righe di codice con | non diventano errori', E.analizza('    if (a.ok || b) {\n  5 | x = a||b;\n').length === 0);
// printf con un valore al posto di un indirizzo non è uno scanf senza &
const F3 = '#include <stdio.h>\nint main(void) {\n    char c = \'a\';\n    int n = 3;\n    double x;\n    unsigned long u = 5;\n    printf("%s\\n", c);\n    printf("Hai %s anni\\n", n);\n    scanf("%f", &x);\n    printf("%d\\n", u);\n    int k;\n    scanf("%d", k);\n    return 0;\n}\n';
const F3_CLANG = "f3.c:7:20: warning: format specifies type 'char *' but the argument has type 'char' [-Wformat]\n    7 |     printf(\"%s\\n\", c);\n      |               ~~     ^\n      |               %c\nf3.c:8:29: warning: format specifies type 'char *' but the argument has type 'int' [-Wformat]\n    8 |     printf(\"Hai %s anni\\n\", n);\n      |                 ~~          ^\n      |                 %d\nf3.c:9:17: warning: format specifies type 'float *' but the argument has type 'double *' [-Wformat]\n    9 |     scanf(\"%f\", &x);\n      |            ~~   ^~\n      |            %lf\nf3.c:10:20: warning: format specifies type 'int' but the argument has type 'unsigned long' [-Wformat]\n   10 |     printf(\"%d\\n\", u);\n      |             ~~     ^\n      |             %lu\nf3.c:12:17: warning: format specifies type 'int *' but the argument has type 'int' [-Wformat]\n   12 |     scanf(\"%d\", k);\n      |            ~~   ^\n6 warnings generated.\n";
const f3 = E.analizza(F3_CLANG), perRiga = n => f3.find(d => d.riga === n);
prova('printf("%s", c) con char c: formato, non scanf', perRiga(7)?.chiave === 'formato' && E.spiega(perRiga(7)).passi[1].testo.includes('Per un `char` in `printf` si usa `%c`'), vedi(perRiga(7)));
prova('printf("Hai %s anni", n) con int n: formato, non scanf', perRiga(8)?.chiave === 'formato' && !/scanf/.test(E.spiega(perRiga(8)).intestazione));
prova('scanf("%d", k) senza &: resta «manca &»', perRiga(12)?.chiave === 'scanf-e-commerciale');
prova('senza la riga: un char * atteso non basta per dire scanf', primo("a.c:7:20: warning: format specifies type 'char *' but the argument has type 'char' [-Wformat]\n")?.chiave === 'formato' && primo("a.c:4:17: warning: format specifies type 'int *' but the argument has type 'int' [-Wformat]\n")?.chiave === 'scanf-e-commerciale');
prova('con il file vero decide la riga: printf → formato', E.spiega({ ...perRiga(12), riga: 7, righeUscita: {} }, { sorgente: F3 }).chiave === 'formato' && E.spiega(perRiga(12), { sorgente: F3 }).chiave === 'scanf-e-commerciale');
sp = E.spiega(perRiga(9), { sorgente: F3 });
prova('scanf("%f", &x) con double x: parla di scanf e di %lf', /In `scanf`/.test(sp.passi[1].testo) && /`%lf`/.test(sp.passi[1].testo) && !/`%f` per i `double`/.test(sp.passi[1].testo) && E.voce('formato').etichetta.includes('scanf'), sp.passi[1].testo);
sp = E.spiega(perRiga(10));
prova('unsigned long: %lu, e %zu solo per size_t', /`%lu`/.test(sp.passi[1].testo) && /size_t/.test(sp.passi[1].testo) && !/unsigned long` in `printf` si usa `%zu`/.test(sp.passi[1].testo), sp.passi[1].testo);
sp = E.spiega(primo("doppio.c:3:13: warning: implicit declaration of function 'doppio' [-Wimplicit-function-declaration]\n"));
prova('funzione non dichiarata con gcc ≤ 13 (avviso): niente «si ferma» secco', sp.passi[1].testo.startsWith('È un avviso') && /tirano a indovinare/.test(sp.passi[1].testo) && !/vista, si ferma\./.test(sp.passi[1].testo), sp.passi[1].testo);
prova('if vuoto: «dell\'`if`», mai «del `if`»', E.spiega(primo(VERE.vuoto)).frase.includes("dell'`if`") && !E.spiega(primo(VERE.vuoto)).frase.includes('del `if`'));
sp = E.spiega(primo("a.c:5:9: warning: suggest braces around empty body in an 'else' statement [-Wempty-body]\n"));
prova('if vuoto con else: niente condizione né parentesi', /subito dopo `else`/.test(sp.frase) && !/condizione del/.test(sp.frase) && !/\)/.test(sp.passi[0].testo), testi(sp));
prova('valutato: la correzione nascosta si sa', E.spiega(primo(VERE.pv), { valutato: true }).correzioneNascosta === true && E.spiega(primo(VERE.pv)).correzioneNascosta === false && E.spiega(primo(VERE.nondich), { valutato: true }).correzioneNascosta === false);
// tempi: il main legge gli appunti con analizza(), che non deve bloccarsi su testi strani
for (const [nome, t] of [['200 KB di spazi', ' '.repeat(199000) + 'x'], ['«: » ripetuto', ': '.repeat(99000)], ['traceback lungo', 'Traceback (most recent call last):\n' + '  File "a.py", line 1, in f\n'.repeat(5000) + 'x'.repeat(50000)], ['linker su una riga lunga', 'x'.repeat(199000) + " undefined reference to `f'"], ['Error e spazi', 'Error' + ' '.repeat(199000) + 'x']]) {
  const t0 = performance.now(); E.analizza(t); const ms = performance.now() - t0;
  prova(`tempo: ${nome} in meno di 200 ms`, ms < 200, Math.round(ms) + ' ms');
}
prova('spiegaTesto: dal testo copiato', E.spiegaTesto(VERE.nondich)?.spiegazione?.chiave === 'non-dichiarato' && E.spiegaTesto('niente di utile') === null);

// ---------- dal vivo: compilatore e Python di questo computer ----------
const trova = nomi => nomi.find(n => { try { return spawnSync(n, ['--version'], { encoding: 'utf8', timeout: 10000 }).status === 0; } catch { return false; } });
const cc = trova(['cc', 'gcc', 'clang']);
const tmp = mkdtempSync(join(tmpdir(), 'lode-errori-'));
try {
  if (cc) {
    const ROTTI = {
      'punto-e-virgola': '#include <stdio.h>\nint main(void) {\n    int x = 5\n    printf("%d\\n", x);\n    return 0;\n}\n',
      'non-dichiarato': '#include <stdio.h>\nint main(void) {\n    printf("%d\\n", nodo);\n    return 0;\n}\n',
      'include-mancante': 'int main(void) {\n    printf("ciao\\n");\n    return 0;\n}\n',
      'assegnamento-in-condizione': '#include <stdio.h>\nint main(void) {\n    int x = 3;\n    if (x = 5) printf("si\\n");\n    return 0;\n}\n',
      'return-mancante': 'int massimo(int a, int b) {\n    if (a > b)\n        return a;\n}\nint main(void) { return massimo(1, 2); }\n',
      'tipi-in-conflitto': 'int doppio(int x);\ndouble doppio(int x) { return x * 2.0; }\nint main(void) { return 0; }\n',
      'argomenti': 'int somma(int a, int b) { return a + b; }\nint main(void) { return somma(1); }\n',
      'graffa': 'int main(void) {\n    for (int i = 0; i < 3; i++) {\n    return 0;\n}\n',
      'header-non-trovato': '#include <stdoi.h>\nint main(void) { return 0; }\n',
      'riferimento-non-definito': 'int calcola(int x);\nint main(void) { return calcola(2); }\n',
    };
    for (const [chiave, codice] of Object.entries(ROTTI)) {
      const f = join(tmp, chiave + '.c'); writeFileSync(f, codice);
      const args = chiave === 'riferimento-non-definito' ? ['-std=c11', f, '-o', join(tmp, 'x.out')] : ['-std=c11', '-Wall', '-Wextra', '-c', f, '-o', join(tmp, 'x.o')];
      const r = spawnSync(cc, args, { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', LANG: 'C' }, timeout: 60000 });
      const lista = E.analizza(r.stderr + r.stdout);
      prova(`dal vivo (${cc}): ${chiave}`, lista.some(d => d.chiave === chiave), (r.stderr + r.stdout).split('\n').slice(0, 3).join(' / '));
    }
    // un crash vero: puntatore NULL
    const f = join(tmp, 'crash.c'); writeFileSync(f, '#include <stdio.h>\nint main(void) {\n    int *p = NULL;\n    printf("%d\\n", *p);\n    return 0;\n}\n');
    const c = spawnSync(cc, ['-O0', f, '-o', join(tmp, 'crash.out')], { encoding: 'utf8', timeout: 60000 });
    if (c.status === 0) { const r = spawnSync(join(tmp, 'crash.out'), { encoding: 'utf8', timeout: 10000 }); prova(`dal vivo (${cc}): crash con NULL`, E.analizzaUscita({ codice: r.status, segnale: r.signal, stderr: r.stderr }).some(d => d.chiave === 'esec-memoria'), `${r.status} ${r.signal}`); }
  } else console.log('(nessun compilatore C nel PATH: prove dal vivo del C saltate)');
  const py = trova(process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python']);
  if (py) {
    const PROG = { 'py-indice': 'v = [1, 2, 3]\nprint(v[3])\n', 'py-nome': 'print(totale)\n', 'py-divisione-zero': 'def media(v):\n    return sum(v) / len(v)\nprint(media([]))\n', 'py-indentazione': 'if True:\nprint("si")\n' };
    for (const [chiave, codice] of Object.entries(PROG)) {
      const f = join(tmp, chiave + '.py'); writeFileSync(f, codice);
      const r = spawnSync(py, py === 'py' ? ['-3', f] : [f], { encoding: 'utf8', timeout: 20000 });
      prova(`dal vivo (${py}): ${chiave}`, E.analizzaUscita({ codice: r.status, stderr: r.stderr }).some(d => d.chiave === chiave && E.nomeFile(d.file) === chiave + '.py'), r.stderr.split('\n').slice(-3).join(' / '));
    }
  } else console.log('(Python non trovato: prove dal vivo di Python saltate)');
} finally { rmSync(tmp, { recursive: true, force: true }); }

console.log(`errori: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
