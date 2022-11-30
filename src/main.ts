import {readdirSync, readFileSync, writeFileSync} from "fs"
import {AuArgs, parseAuArgs} from "./args"
import {
  compileGenerator,
  parseGenerator,
  WordGenerator,
} from "./generator"
import {Gloss, literal, parseGloss, serializeGloss} from "./gloss"
import {
  Lexeme,
  Lexicon,
  LexiconIndex,
  parseLexicon,
  serializeLexicon,
} from "./lexicon"
import {parseArgs} from "./lib/args"
import {exhausted} from "./lib/exhaust"
import {_} from "./lib/functions"
import {Result, success} from "./lib/result"
import {matches} from "./lib/strings"
import {Morphology, parseMorphology} from "./morphology"
import {parseText, Text, toString} from "./text"
import {Translator} from "./translator"

export function main() {
  const args = _(
    process.argv.slice(2),
    parseArgs,
    parseAuArgs,
    Result.recover<AuArgs, string>((failure) => {
      console.error(failure.detail)
      process.exit(1)
    }),
  )

  const exitOnFailure = Result.recover<void, string>((failure) => {
    console.error(failure.detail)
    process.exit(1)
  })

  process.chdir(args.workingDirectory)

  switch (args.subcommand) {
    case "":
      _(defaultSubcommand(), exitOnFailure)
      break
    case "tr":
      _(tr(args), exitOnFailure)
      break
    case "gen":
      _(gen(args), exitOnFailure)
      break
    default:
      throw exhausted(args)
  }
}

function defaultSubcommand() {
  type Inputs = {
    lexicon: Result<Lexicon, string>
    morphology: Result<Morphology, string>
    texts: Result<Array<[string, Text]>, string>
  }
  return _(
    Result.objAll<Inputs, string>({
      lexicon: _(
        readFileSync("lexicon.csv").toString(),
        parseLexicon,
      ),
      morphology: _(
        readFileSync("morphology.yaml").toString(),
        parseMorphology,
      ),
      texts: Result.all(
        readdirSync(".")
          .filter(matches(/\.au$/))
          .map(
            (filename) =>
              _(
                [
                  success(filename),
                  parseText(readFileSync(filename).toString()),
                ] as [Result<string, string>, Result<Text, string>],
                Result.all,
              ) as Result<[string, Text], string>,
          ),
      ),
    }),
    Result.map(({lexicon, morphology, texts}) => {
      const translate = Translator(index(lexicon), morphology)
      return texts.map(second((text) => toString(translate, text)))
    }),
    Result.map((texts) => {
      texts
        .map(first(removeAuExtension))
        .map(([filename, translated]) =>
          writeFileSync(filename, translated),
        )
    }),
  )
}

function tr(
  args: Extract<AuArgs, {subcommand: "tr"}>,
): Result<void, string> {
  type Inputs = {
    lexicon: Result<Lexicon, string>
    morphology: Result<Morphology, string>
    glossesToTranslate: Result<Array<Gloss>, string>
  }
  return _(
    Result.objAll<Inputs, string>({
      lexicon: _(
        readFileSync("lexicon.csv").toString(),
        parseLexicon,
      ),
      morphology: _(
        readFileSync("morphology.yaml").toString(),
        parseMorphology,
      ),
      glossesToTranslate: Result.all(
        args.glossesToTranslate.map((g) =>
          parseGloss("implicit-pointers", g),
        ),
      ),
    }),
    Result.map(({lexicon, morphology, glossesToTranslate}) => {
      const translate = Translator(index(lexicon), morphology)
      console.log(glossesToTranslate.map(translate).join(" "))
    }),
  )
}

function gen(
  args: Extract<AuArgs, {subcommand: "gen"}>,
): Result<void, string> {
  type Inputs = {
    lexicon: Result<Lexicon, string>
    generator: Result<(ruleName?: string) => string, string>
  }
  return _(
    Result.objAll<Inputs, string>({
      lexicon: _(
        readFileSync("lexicon.csv").toString(),
        parseLexicon,
      ),
      generator: _(
        readFileSync("generator.txt").toString(),
        parseGenerator,
        Result.flatMap(compileGenerator(Math.random)),
      ),
    }),
    Result.map(({lexicon, generator}) => {
      const updatedLexicon = {
        ...lexicon,
        lexemes: lexicon.lexemes.map((lexeme) => {
          if (needsRegeneration(lexeme)) {
            return {
              ...lexeme,
              translation: literal(`?${generator(lexeme.generator)}`),
            }
          } else {
            return lexeme
          }
        }),
      }
      writeFileSync("lexicon.csv", serializeLexicon(updatedLexicon))
    }),
  )

  function needsRegeneration(lexeme: Lexeme): boolean {
    const lexemeAsString = serializeGloss(
      "implicit-literals",
      lexeme.translation,
    )
    return lexemeAsString === "" || lexemeAsString[0] === "?"
  }
}

function first<A, B, Out>(
  f: (arg: A) => Out,
): (arg: [A, B]) => [Out, B] {
  return ([a, b]) => [f(a), b]
}

function second<A, B, Out>(
  f: (arg: B) => Out,
): (arg: [A, B]) => [A, Out] {
  return ([a, b]) => [a, f(b)]
}

function index(lexicon: Lexicon): LexiconIndex {
  const lexiconIndex: {[id: string]: Gloss} = {}
  for (const lexeme of lexicon.lexemes) {
    lexiconIndex[lexeme.id] = lexeme.translation
  }
  return lexiconIndex
}

function removeAuExtension(filename: string): string {
  return filename.replace(/\.au$/, "")
}
