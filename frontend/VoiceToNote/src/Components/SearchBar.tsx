import "./SearchBar.css";

interface SearchBarProps {
  onSearch?: (query: string) => void;
}

const SearchBar = ({ onSearch }: SearchBarProps) => {
  return (
    <div id="header">
      <input
        className="search-bar"
        type="text"
        placeholder="Search for Notes"
        onChange={(e) => onSearch?.(e.target.value)}
      />
    </div>
  );
};

export default SearchBar;
