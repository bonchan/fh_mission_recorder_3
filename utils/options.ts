
import { FilterOption } from '@/components/ui/MultiSelectFilter';
import { ROUTE_SAFETY_STATUSES, RouteSafetyStatus, ImageFormat } from '@/utils/interfaces';


export const STATUS_OPTIONS: FilterOption<RouteSafetyStatus>[] = ROUTE_SAFETY_STATUSES.map(status => ({
  value: status,
  // Helper to make them pretty: "PATH_COMPROMISED" -> "COMPROMISED" or "PATH COMPROMISED"
  label: status === 'PATH_COMPROMISED' ? 'COMPROMISED' : status.replace('_', ' ')
}));

export const IMAGE_FORMAT_OPTIONS: FilterOption<ImageFormat>[] = [
  { label: 'Visible', value: ImageFormat.VISIBLE },
  { label: 'Infrared', value: ImageFormat.INFRARED },
];