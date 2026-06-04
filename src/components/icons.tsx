import playRaw from '../icons/playback/play.svg?raw'
import pauseRaw from '../icons/playback/pause.svg?raw'
import prevRaw from '../icons/playback/prev.svg?raw'
import nextRaw from '../icons/playback/next.svg?raw'
import shuffleRaw from '../icons/playback/shuffle.svg?raw'
import repeatRaw from '../icons/playback/repeat.svg?raw'
import repeat1Raw from '../icons/playback/repeat1.svg?raw'

import backRaw from '../icons/ui/back.svg?raw'
import searchRaw from '../icons/ui/search.svg?raw'
import queueRaw from '../icons/ui/queue.svg?raw'
import settingsRaw from '../icons/ui/settings.svg?raw'

import volumeHighRaw from '../icons/volume/volume-high.svg?raw'
import volumeLowRaw from '../icons/volume/volume-low.svg?raw'
import volumeMuteRaw from '../icons/volume/volume-mute.svg?raw'

import heartRaw from '../icons/actions/heart.svg?raw'
import downloadRaw from '../icons/actions/download.svg?raw'
import playCircleRaw from '../icons/actions/play-circle.svg?raw'
import serviceMarkRaw from '../icons/actions/service-mark.svg?raw'

function Icon({ raw, width, height }: { raw: string; width?: number; height?: number }) {
  const svg = (width || height)
    ? raw.replace('<svg ', `<svg width="${width ?? ''}" height="${height ?? ''}" `)
    : raw
  return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: svg }} />
}

export const Icons = {
  prev:        <Icon raw={prevRaw} />,
  next:        <Icon raw={nextRaw} />,
  play:        <Icon raw={playRaw} />,
  pause:       <Icon raw={pauseRaw} />,
  heart:       <Icon raw={heartRaw} />,
  shuffle:     <Icon raw={shuffleRaw} />,
  shuffle2:    <Icon raw={shuffleRaw} />,
  repeat:      <Icon raw={repeatRaw} />,
  repeat1:     <Icon raw={repeat1Raw} />,
  queue:       <Icon raw={queueRaw} />,
  back:        <Icon raw={backRaw} />,
  search:      <Icon raw={searchRaw} />,
  download:    <Icon raw={downloadRaw} />,
  playCircle:  <Icon raw={playCircleRaw} />,
  volumeHigh:  <Icon raw={volumeHighRaw} />,
  volumeLow:   <Icon raw={volumeLowRaw} />,
  volumeMute:  <Icon raw={volumeMuteRaw} />,
  settings:    <Icon raw={settingsRaw} />,
  serviceMark: <Icon raw={serviceMarkRaw} width={30} height={30} />,
}
