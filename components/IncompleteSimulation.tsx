import {RunStatus} from '@covid-policy-modelling/api'
import StatusBlock from './StatusBlock'

interface Props {
  status:
    | RunStatus.Pending
    | RunStatus.InProgress
    | RunStatus.Failed
    | RunStatus.Unsupported
  title: string
  message: string
}

export default function IncompleteSimulation(props: Props) {
  return (
    <StatusBlock statusKey={props.status}>
      <h1 className="text-2xl font-bold text-center">{props.title}</h1>
      <p className="mt-4">{props.message}</p>
    </StatusBlock>
  )
}
