import * as output from '@covid-policy-modelling/api/output-common'
import {DateTime} from 'luxon'
import {last} from 'lib/arrayMath'
import * as db from 'lib/db'
import {CaseSummary, Simulation} from 'lib/simulation-types'
import {withDB} from 'lib/mysql'
import {getBlob} from 'pages/api/util/blob-storage'
import dispatch from 'pages/api/util/dispatch'
import requireSession from 'pages/api/util/require-session'

export default withDB(conn =>
  requireSession(ssn =>
    dispatch('GET', async (req, res) => {
      /*
       * @oas [get] /simulations/{id}/case-summary
       * description: Retrieves summary result of simulation
       * parameters:
       *   - (path) id=1* {integer} Simulation ID
       * responses:
       *   200:
       *    description: Successful operation
       *    content:
       *      application/json; charset=utf-8:
       *        schema:
       *          "$ref": "#/components/schemas/CaseSummary"
       * operationId: getSimulationCaseSummary
       * tags: ["simulations"]
       */
      const id = parseInt(req.query.id as string)
      const sim = await db.getSimulation(conn, ssn.user, {id})

      if (!sim) {
        res.status(404).json({error: 'Not found'})
        return
      }
      const allResults = await fetchSimulationResults(sim)

      const summarizedResults = allResults.reduce<CaseSummary>(
        (sum, [slug, out]) => {
          const metrics = out.aggregate.metrics

          // maxIndex finds the last peak value, we want the earliest occurrence (rounded)
          const peakDailyDeathIdx = metrics.incDeath.reduce(
            ([maxI, maxV], v, i) =>
              Math.round(v) > maxV ? [i, Math.round(v)] : [maxI, maxV],
            [0, 0]
          )[0]

          const peakDailyDeath = metrics.incDeath[peakDailyDeathIdx]
          const peakDailyDeathTs = out.time.timestamps[peakDailyDeathIdx]
          const peakDeath = DateTime.fromISO(out.time.t0).plus({
            days: peakDailyDeathTs
          })

          sum[slug] = {
            cConf: Math.round(getCumulativeConfirmed(metrics)),
            cHosp: Math.round(getCumulativeHospitalized(metrics)),
            cDeaths: Math.round(getCumulativeDeaths(metrics)),
            peakDeath: peakDeath.toISODate(),
            peakDailyDeath: Math.round(peakDailyDeath),
            modelVersion: out.model?.modelVersion
          }

          return sum
        },
        {}
      )

      res.status(200).json(summarizedResults)
    })
  )
)

async function fetchSimulationResults(
  sim: Simulation
): Promise<[string, output.CommonModelOutput][]> {
  const allRaw = await Promise.all(
    sim.model_runs.map<Promise<[string, string | null]>>(async run => {
      return [
        run.model_slug,
        run.results_data ? await getBlob(run.results_data) : null
      ]
    })
  )

  return allRaw
    .filter(([, data]) => isResult(data))
    .map(([slug, data]) => [
      slug,
      JSON.parse(data!) as output.CommonModelOutput
    ])
}

// Sum of all case types.
function getCumulativeConfirmed(met: output.SeverityMetrics): number {
  return (
    last(met.cumMild) +
    last(met.cumILI) +
    last(met.cumSARI) +
    last(met.cumCritical)
  )
}

// Sum of all deaths.
function getCumulativeDeaths(met: output.SeverityMetrics): number {
  return met.incDeath.reduce((s, m) => s + m, 0)
}

// Sum of normal and ICU hospital beds.
function getCumulativeHospitalized(met: output.SeverityMetrics): number {
  return last(met.cumSARI) + last(met.cumCritRecov) + last(met.cumCritical)
}

function isResult(r: unknown): r is string {
  // Type predicate helps the `filter/map`
  return r != null
}
