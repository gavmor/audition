import {
  curry,
  equals,
  expect,
  test,
  which,
  debug,
} from "@benchristel/taste"
import {Gloss, parseGloss} from "./gloss"
import {_} from "./lib/functions"
import {failure, Result, success} from "./lib/result"
import {matches} from "./lib/strings"
import {TranslateFn} from "./translator"

export type Text = Array<Segment>
export type Segment =
  | {translatable: false; string: string}
  | {translatable: true; gloss: Gloss}

const dummyTranslate = () => ""

test("parse and toString", {
  "round-trip the empty string"() {
    const result = _(
      "",
      parseText,
      Result.map(toString(dummyTranslate)),
    )
    expect(result, equals, success(""))
  },

  "round-trip a string with no translatable segments"() {
    const result = _(
      "English text",
      parseText,
      Result.map(toString(dummyTranslate)),
    )
    expect(result, equals, success("English text"))
  },

  "round-trip a string with only a translatable segment"() {
    const result = _(
      "__bear#PL__",
      parseText,
      Result.map(toString(() => "bäryn")),
    )
    expect(result, equals, success("__bäryn__"))
  },

  "round-trips a string with several segments"() {
    const result = _(
      "the word for bears is __bear#PL__ and also __bear#PL__!",
      parseText,
      Result.map(toString(() => "bäryn")),
    )
    expect(
      result,
      equals,
      success("the word for bears is __bäryn__ and also __bäryn__!"),
    )
  },

  "translates a gloss with spaces and punctuation"() {
    const result = _(
      "__foo, bar, & baz.__",
      parseText,
      Result.map(toString(() => "translated")),
    )
    expect(
      result,
      equals,
      success("__translated, translated, & translated.__"),
    )
  },

  "fails if a gloss can't be parsed"() {
    const result = _(
      "the word for bears is __[[__!",
      parseText,
      Result.map(toString(() => "")),
    )
    expect(
      result,
      equals,
      failure(which(matches(/Failed to parse "\[\["/))),
    )
  },
})

export function parseText(raw: string): Result<Text, string> {
  const parseSegment = (
    rawSegment: string,
    i: number,
  ): Array<Result<Segment, string>> => {
    return i % 4 === 2
      ? parseGlosses(rawSegment)
      : [success({translatable: false, string: rawSegment})]
  }
  return Result.all(raw.split(/(__)/).flatMap(parseSegment))
}

export const toString = curry(
  (translate: TranslateFn, text: Text): string => {
    return text
      .map((segment) =>
        segment.translatable
          ? translate(segment.gloss)
          : segment.string,
      )
      .join("")
  },
  "toString",
)

function parseGlosses(
  rawSegment: string,
): Array<Result<Segment, string>> {
  return rawSegment
    .split(/([~`!@\$%&\(\)\=\{\}\\\|;:'",<\.>/\? \t\n\r]+)/)
    .map(
      (s, i) =>
        (i % 2 === 0 && s.length
          ? Result.objAll({
              translatable: success(true),
              gloss: parseGloss("implicit-pointers", s),
            })
          : success({translatable: false, string: s})) as Result<
          Segment,
          string
        >,
    )
}
