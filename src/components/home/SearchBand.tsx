// src/components/home/SearchBand.tsx
import { IconSearch } from './icons';

export function SearchBand() {
  return (
    <div className="m-searchband">
      <div className="m-wrap">
        <div className="m-searchbox">
          <IconSearch />
          <input placeholder="Search a street, neighbourhood, or homes for sale in Milton" />
          <button>Search</button>
        </div>
        <div className="m-searchhint">
          One bar, two doors — <b>find your street</b> for editorial depth, or{' '}
          <b>explore listings</b> for live MLS.
        </div>
      </div>
    </div>
  );
}
