import { Component, For } from 'solid-js';
import { 
  Plus, 
  Search, 
  LayoutGrid, 
  List, 
  Layers, 
  SlidersHorizontal 
} from 'lucide-solid';
import { MockCategory } from '../services/mockData';

interface CategoryFilterProps {
  categories: MockCategory[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  onOpenCategoryModal: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
  totalSitesCount: number;
}

export const CategoryFilter: Component<CategoryFilterProps> = (props) => {
  return (
    <div class="category-ribbon">
      {/* Category Pills Scroll Container */}
      <div class="category-tabs-scroll">
        <button
          class={`cat-chip ${props.selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => props.onSelectCategory('all')}
        >
          <Layers size={14} />
          <span>All Sites</span>
          <span class="cat-badge">{props.totalSitesCount}</span>
        </button>

        <For each={props.categories}>
          {(cat) => (
            <button
              class={`cat-chip ${props.selectedCategory === cat.id ? 'active' : ''}`}
              style={{ '--chip-color': cat.color }}
              onClick={() => props.onSelectCategory(cat.id)}
            >
              <span class="cat-color-dot" style={{ "background-color": cat.color }}></span>
              <span>{cat.name}</span>
              <span class="cat-badge">{cat.site_count || 0}</span>
            </button>
          )}
        </For>

        <button
          class="cat-chip btn-outline"
          onClick={props.onOpenCategoryModal}
          title="Create or manage website categories"
        >
          <Plus size={14} />
          <span>Category Manager</span>
        </button>
      </div>

      {/* Search & View Switcher */}
      <div class="ribbon-controls">
        <div class="search-input-wrapper">
          <Search size={15} />
          <input
            type="text"
            class="search-input"
            placeholder="Search domain or keyword..."
            value={props.searchQuery}
            onInput={(e) => props.onSearchChange(e.currentTarget.value)}
          />
        </div>

        <div class="view-toggle">
          <button
            class={props.viewMode === 'grid' ? 'active' : ''}
            onClick={() => props.onViewModeChange('grid')}
            title="Card Grid View"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            class={props.viewMode === 'table' ? 'active' : ''}
            onClick={() => props.onViewModeChange('table')}
            title="Detailed Table View"
          >
            <List size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
