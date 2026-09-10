interface Coordinate {
  latitude: number;
  longitude: number;
}

interface LocationSelection extends Coordinate {
  location: string;
  googleMapsLink: string;
}

interface LocationPickerModalProps {
  visible: boolean;
  initialCoordinate?: Coordinate;
  initialLabel?: string;
  onClose: () => void;
  onSelect: (selection: LocationSelection) => void;
}

export declare function LocationPickerModal(props: LocationPickerModalProps): ReactElement;
import type { ReactElement } from "react";
