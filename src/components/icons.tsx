import type { FC, SVGProps } from 'react'
import PlayIcon from '../icons/playback/play.svg?react'
import PauseIcon from '../icons/playback/pause.svg?react'
import PrevIcon from '../icons/playback/prev.svg?react'
import NextIcon from '../icons/playback/next.svg?react'
import ShuffleIcon from '../icons/playback/shuffle.svg?react'
import RepeatIcon from '../icons/playback/repeat.svg?react'
import Repeat1Icon from '../icons/playback/repeat1.svg?react'

import BackIcon from '../icons/ui/back.svg?react'
import SearchIcon from '../icons/ui/search.svg?react'
import QueueIcon from '../icons/ui/queue.svg?react'
import SettingsIcon from '../icons/ui/settings.svg?react'

import VolumeHighIcon from '../icons/volume/volume-high.svg?react'
import VolumeLowIcon from '../icons/volume/volume-low.svg?react'
import VolumeMuteIcon from '../icons/volume/volume-mute.svg?react'

import HeartIcon from '../icons/actions/heart.svg?react'
import DownloadIcon from '../icons/actions/download.svg?react'
import PlayCircleIcon from '../icons/actions/play-circle.svg?react'
import ServiceMarkIcon from '../icons/actions/service-mark.svg?react'

function Icon({ Svg, width, height }: { Svg: FC<SVGProps<SVGSVGElement>>; width?: number; height?: number }) {
  return <span className="icon"><Svg width={width} height={height} color="inherit" /></span>
}

export const Icons = {
  prev:        <Icon Svg={PrevIcon} />,
  next:        <Icon Svg={NextIcon} />,
  play:        <Icon Svg={PlayIcon} />,
  pause:       <Icon Svg={PauseIcon} />,
  heart:       <Icon Svg={HeartIcon} />,
  shuffle:     <Icon Svg={ShuffleIcon} />,
  shuffle2:    <Icon Svg={ShuffleIcon} />,
  repeat:      <Icon Svg={RepeatIcon} />,
  repeat1:     <Icon Svg={Repeat1Icon} />,
  queue:       <Icon Svg={QueueIcon} />,
  back:        <Icon Svg={BackIcon} />,
  search:      <Icon Svg={SearchIcon} />,
  download:    <Icon Svg={DownloadIcon} />,
  playCircle:  <Icon Svg={PlayCircleIcon} />,
  volumeHigh:  <Icon Svg={VolumeHighIcon} />,
  volumeLow:   <Icon Svg={VolumeLowIcon} />,
  volumeMute:  <Icon Svg={VolumeMuteIcon} />,
  settings:    <Icon Svg={SettingsIcon} />,
  serviceMark: <Icon Svg={ServiceMarkIcon} width={30} height={30} />,
}
