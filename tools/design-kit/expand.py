#!/usr/bin/env python3
"""Expands the design reference source (guide.src.md) into one self contained Markdown file.

Directives, each on a line of its own (paths are relative to platform/design):
  @@file <path> <lang>          the whole file in a fenced code block
  @@css <path> :: <regex>       every rule of a CSS file whose selector matches <regex> (Python re.search),
                                copied verbatim in file order; rules inside @media blocks keep their @media wrapper
Everything else is copied as is. A regex that names an @media block copies the whole block. Usage: python3 expand.py <source.md> <design dir>  (writes to stdout)
"""
import re
import sys

SRC, DESIGN = sys.argv[1], sys.argv[2]


def parse_rules(css, start=0, end=None):
    """Top level rules of css[start:end] as (prelude, text, inner) where inner is a list for @media blocks."""
    end = len(css) if end is None else end
    out, i = [], start
    while i < end:
        # skip whitespace and comments
        if css[i].isspace():
            i += 1
            continue
        if css.startswith("/*", i):
            j = css.find("*/", i + 2)
            i = end if j < 0 else j + 2
            continue
        # read the prelude up to "{" (or ";" for @import style statements)
        j = i
        while j < end and css[j] not in "{;":
            if css.startswith("/*", j):
                j = css.find("*/", j + 2) + 2
                continue
            j += 1
        if j >= end:
            break
        prelude = css[i:j].strip()
        if css[j] == ";":
            i = j + 1
            continue
        # find the matching closing brace, skipping strings and comments
        depth, k = 0, j
        while k < end:
            c = css[k]
            if css.startswith("/*", k):
                k = css.find("*/", k + 2) + 2
                continue
            if c in "\"'":
                q = c
                k += 1
                while k < end and css[k] != q:
                    k += 2 if css[k] == "\\" else 1
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    break
            k += 1
        text = css[i:k + 1]
        inner = parse_rules(css, j + 1, k) if prelude.startswith("@media") or prelude.startswith("@supports") else None
        out.append((prelude, text, inner))
        i = k + 1
    return out


def pick(rules, rx):
    lines = []
    for prelude, text, inner in rules:
        if inner is not None:
            if rx.search(prelude):   # the regex names the @media block itself: copy it whole
                lines.append(text.strip())
                continue
            hits = [t for p, t, n in inner if n is None and rx.search(" ".join(p.split()))]
            if hits:
                lines.append(prelude + " { " + " ".join(h.strip() for h in hits) + " }")
        elif rx.search(" ".join(prelude.split())):   # a rule, or an @keyframes named by the regex
            lines.append(text.strip())
    return lines


def main():
    out = []
    for line in open(SRC, encoding="utf-8").read().split("\n"):
        m = re.match(r"^@@file\s+(\S+)\s+(\S+)\s*$", line)
        if m:
            body = open(DESIGN + "/" + m.group(1), encoding="utf-8").read().rstrip("\n")
            out += ["```" + m.group(2), body, "```"]
            continue
        m = re.match(r"^@@css\s+(\S+)\s+::\s+(.+?)\s*$", line)
        if m:
            css = open(DESIGN + "/" + m.group(1), encoding="utf-8").read()
            hits = pick(parse_rules(css), re.compile(m.group(2)))
            if not hits:
                sys.exit("no CSS rule matched: " + line)
            out += ["```css", "/* " + m.group(1) + " */"] + hits + ["```"]
            continue
        if line.startswith("@@"):
            sys.exit("unknown directive: " + line)
        out.append(line)
    sys.stdout.write("\n".join(out).rstrip("\n") + "\n")


main()
