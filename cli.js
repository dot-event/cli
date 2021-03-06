import findUp from "find-up"
import { readJson } from "fs-extra"
import { dirname, join } from "path"

module.exports = dot => {
  if (dot.cli) {
    return
  }

  dot.any("log", "error", () => process.exit(1))
  dot.any("cli", cli)
}

async function cli(prop, arg, dot) {
  const argv = await dot.argv(prop)

  if (argv.log) {
    dot("logLevel", { arg: argv.log })
  }

  var eventId = argv._.shift()

  if (!eventId) {
    dot("log", "error", prop, "no eventId specified")
  }

  argv.eventId = eventId

  const configPath = await findUp("dot.json")

  if (configPath) {
    const json = await readJson(configPath)
    Object.assign(argv, json[eventId])
  }

  const root = configPath
    ? dirname(configPath)
    : process.cwd()

  eventId = argv.eventId

  const pattern = `${root}/**/${eventId}.js`

  const paths = await dot.glob({
    ignore: "**/node_modules/**",
    pattern,
  })

  var path =
    paths.find(path => path.indexOf("/dist/") > -1) ||
    paths[0]

  if (!path) {
    path = require.resolve(eventId)
  }

  if (!path) {
    dot(
      "log",
      "error",
      prop,
      `could not find ${eventId} at ${pattern} or from global packages`
    )
  }

  const pkgPath = await findUp("package.json", {
    cwd: path,
  })

  const pkgDir = dirname(pkgPath)

  const off = dot.any(
    "dependencies",
    addDependencies.bind({ pkgDir })
  )

  require(path)(dot)

  off()

  dot(eventId, argv.props, argv)
}

function addDependencies(prop, arg, dot) {
  const { pkgDir } = this

  arg.forEach(dep => {
    const relPath = join(pkgDir, "../../", dep)
    var lib

    try {
      lib = require(relPath)
    } catch (e) {
      try {
        lib = require(dep)
      } catch (e) {
        null
      }
    }

    if (lib) {
      lib(dot)
    } else {
      dot(
        "log",
        "error",
        `could not find ${dep} from ${relPath} or from global packages`
      )
    }
  })
}
