// Simple search input. Calls onSearch with the current value on every keystroke.
// Parent is responsible for filtering the notes list.

import { RiSearchLine } from "react-icons/ri";
import "./SearchBar.css";

interface SearchBarProps {
  onSearch?: (query: string) => void;
}

const SearchBar = ({ onSearch }: SearchBarProps) => {
  return (
    <div className="search-wrapper">
      <RiSearchLine className="search-icon" size={16} />
      <input
        className="search-input"
        type="text"
        placeholder="Search notes..."
        onChange={(e) => onSearch?.(e.target.value)}
      />
    </div>
  );
};

export default SearchBar;
