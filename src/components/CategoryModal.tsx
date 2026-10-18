import { Component, createSignal, For } from 'solid-js';
import { X, Plus, Trash2, Folder, Check } from 'lucide-solid';
import { MockCategory } from '../services/mockData';

interface CategoryModalProps {
  categories: MockCategory[];
  onClose: () => void;
  onCreateCategory: (name: string, color: string, description: string) => void;
  onDeleteCategory: (id: string) => void;
}

const PRESET_COLORS = [
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#84cc16'  // Lime
];

export const CategoryModal: Component<CategoryModalProps> = (props) => {
  const [newCatName, setNewCatName] = createSignal('');
  const [newCatColor, setNewCatColor] = createSignal(PRESET_COLORS[0]);
  const [newCatDesc, setNewCatDesc] = createSignal('');
  const [errorMsg, setErrorMsg] = createSignal('');

  const handleCreate = (e: Event) => {
    e.preventDefault();
    const name = newCatName().trim();
    if (!name) {
      setErrorMsg('Category name is required');
      return;
    }

    props.onCreateCategory(name, newCatColor(), newCatDesc().trim());
    setNewCatName('');
    setNewCatDesc('');
    setErrorMsg('');
  };

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()} style={{ "max-width": '680px' }}>
        <div class="modal-header">
          <h2>Website Categories & Groups</h2>
          <button class="close-btn" onClick={props.onClose}>
            <X size={20} />
          </button>
        </div>

        <div class="modal-body">
          {/* Create New Category Form */}
          <form onSubmit={handleCreate} style={{ display: 'flex', "flex-direction": 'column', gap: '14px', background: 'rgba(255,255,255,0.03)', padding: '16px', "border-radius": 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ "font-size": '0.94rem', color: '#fff', "font-weight": 600 }}>Create New Group</h4>

            <div class="form-group">
              <label class="form-label">Category Name</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g., Client Retainers, High-Growth SaaS"
                value={newCatName()}
                onInput={(e) => setNewCatName(e.currentTarget.value)}
              />
              {errorMsg() && <span style={{ color: 'var(--color-danger)', "font-size": '0.74rem' }}>{errorMsg()}</span>}
            </div>

            <div class="form-group">
              <label class="form-label">Accent Theme Color</label>
              <div class="color-picker-grid">
                <For each={PRESET_COLORS}>
                  {(color) => (
                    <div
                      class={`color-option ${newCatColor() === color ? 'selected' : ''}`}
                      style={{ "background-color": color }}
                      onClick={() => setNewCatColor(color)}
                    >
                      {newCatColor() === color && (
                        <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'center', height: '100%', color: '#fff' }}>
                          <Check size={16} />
                        </div>
                      )}
                    </div>
                  )}
                </For>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Description (optional)</label>
              <input
                type="text"
                class="form-input"
                placeholder="Brief description of this portfolio group"
                value={newCatDesc()}
                onInput={(e) => setNewCatDesc(e.currentTarget.value)}
              />
            </div>

            <div style={{ display: 'flex', "justify-content": 'flex-end', "margin-top": '4px' }}>
              <button type="submit" class="btn btn-primary" style={{ padding: '6px 14px', "font-size": '0.8rem' }}>
                <Plus size={14} />
                <span>Add Category</span>
              </button>
            </div>
          </form>

          {/* Existing Categories List */}
          <div style={{ display: 'flex', "flex-direction": 'column', gap: '10px' }}>
            <h4 style={{ "font-size": '0.9rem', color: 'var(--text-secondary)', "font-weight": 600 }}>
              Existing Categories ({props.categories.length})
            </h4>

            <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px' }}>
              <For each={props.categories}>
                {(cat) => (
                  <div style={{
                    display: 'flex',
                    "align-items": 'center',
                    "justify-content": 'space-between',
                    padding: '12px 16px',
                    background: 'var(--surface-input)',
                    "border-radius": 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ display: 'flex', "align-items": 'center', gap: '10px' }}>
                      <span class="cat-color-dot" style={{ "background-color": cat.color, width: '12px', height: '12px' }}></span>
                      <div>
                        <div style={{ "font-weight": 600, color: '#fff', "font-size": '0.88rem' }}>{cat.name}</div>
                        <div style={{ "font-size": '0.74rem', color: 'var(--text-muted)' }}>
                          {cat.site_count || 0} websites assigned {cat.description ? `• ${cat.description}` : ''}
                        </div>
                      </div>
                    </div>

                    <button
                      class="close-btn"
                      onClick={() => props.onDeleteCategory(cat.id)}
                      title="Delete category"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" onClick={props.onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
