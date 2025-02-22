import {updateUserConfig} from 'lib/db'
import {withDB} from 'lib/mysql'
import dispatch from 'pages/api/util/dispatch'
import requireSession from 'pages/api/util/require-session'

export default withDB(conn =>
  requireSession(session =>
    dispatch('POST', async (req, res) => {
      await updateUserConfig(conn, session.user.login, config => ({
        ...config,
        hasAcceptedDisclaimer: true
      }))

      res.json({ok: true})
    })
  )
)
