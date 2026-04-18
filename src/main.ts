import {readdirSync, readFileSync, writeFileSync} from "fs"
import {compileGenerator, parseGenerator} from "./generator"
import {Gloss, parseGloss} from "./gloss"
import {Lexicon, LexiconIndex, parseLexicon} from "./lexicon"
import {exhausted} from "./lib/exhaust"
import {_} from "./lib/functions"
import {exitOnFailure} from "./lib/process"
import {Result, success} from "./lib/result"
import {matches} from "./lib/strings"
import {Morphology, parseMorphology} from "./morphology"
import {parseText, Text, toString} from "./text"
import {Translator} from "./translator"
import {listRecursively} from "./lib/files"
import {Crust} from "@crustjs/core"
import {helpPlugin} from "@crustjs/plugins"

export async function main() {
  const app = new Crust("au")
    .use(helpPlugin())
    .flags({
      C: {
        type: "string",
        default: ".",
        description: "Working directory",
        inherit: true,
      },
      includeSources: {
        type: "boolean",
        default: false,
        description: "Include sources",
        short: "s",
      },
    })
    .preRun(({flags}) => {
      process.chdir(flags.C)
    })
    .run(({flags}) => {
      const result = defaultSubcommand(flags.includeSources)
      exitOnFailure()(result)
    })

  const trCmd = app
    .sub("tr")
    .args([
      {name: "glossesToTranslate", type: "string", variadic: true},
    ] as const)
    .run(({args}) => {
      const result = tr(args.glossesToTranslate ?? [])
      exitOnFailure()(result)
    })

  const genCmd = app
    .sub("gen")
    .args([{name: "generator", type: "string"}] as const)
    .run(({args}) => {
      const result = gen(args.generator)
      exitOnFailure()(result)
    })

  await app.command(trCmd).command(genCmd).execute()
}

function defaultSubcommand(includeSources: boolean) {
  type Inputs = {
    lexicon: Result<Lexicon, string>
    morphology: Result<Morphology, string>
    texts: Result<Array<[string, Text]>, string>
  }
  return _(
    Result.objAll<Inputs, string>({
      lexicon: loadLexicon(),
      morphology: loadMorphology(),
      texts: loadTexts(),
    }),
    Result.map(({lexicon, morphology, texts}) => {
      const translate = Translator(index(lexicon), morphology)
      return texts.map(
        second(toString(translate, {includeSource: includeSources})),
      )
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

function tr(glossesToTranslate: Array<string>): Result<void, string> {
  type Inputs = {
    lexicon: Result<Lexicon, string>
    morphology: Result<Morphology, string>
    glossesToTranslate: Result<Array<Gloss>, string>
  }
  return _(
    Result.objAll<Inputs, string>({
      lexicon: loadLexicon(),
      morphology: loadMorphology(),
      glossesToTranslate: Result.all(
        glossesToTranslate.map((g) =>
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

function gen(generatorName?: string): Result<void, string> {
  type Inputs = {
    generator: Result<(ruleName?: string) => string, string>
  }
  return _(
    Result.objAll<Inputs, string>({
      generator: _(
        readFileSync("generator.txt").toString(),
        parseGenerator,
        Result.flatMap(compileGenerator(Math.random)),
      ),
    }),
    Result.map(({generator}) => {
      for (let i = 0; i < 30; i++) {
        console.log(generator(generatorName))
      }
    }),
  )
}

function loadLexicon(): Result<Lexicon, string> {
  return _(readFileSync("lexicon.csv").toString(), parseLexicon)
}

function loadMorphology(): Result<Morphology, string> {
  return _(
    readFileSync("morphology.yaml").toString(),
    parseMorphology,
  )
}

function loadTexts(): Result<Array<[string, Text]>, string> {
  return Result.all(
    listRecursively(".")
      .filter(matches(/\.au$/))
      .map((filename) =>
        Result.all([
          success(filename),
          parseText(readFileSync(filename).toString()),
        ]),
      ),
  )
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

if (import.meta.main) {
  main()
}
