from flask import Flask, jsonify, render_template
from mazelib import Maze
from mazelib.generate.Prims import Prims
from mazelib.solve.BacktrackingSolver import BacktrackingSolver
import json

app = Flask(__name__)

@app.after_request
def after_request(response):
    """Sets CORS headers to allow cross-origin requests."""
    header = response.headers
    header['Access-Control-Allow-Origin'] = '*'
    header['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    header['Access-Control-Allow-Methods'] = 'OPTIONS, HEAD, GET, POST, DELETE, PUT'
    return response

# --- Data Loading ---
with open('quiz.json') as f:
    quiz_data = json.load(f)

# --- Helper Functions ---
def find_first_open(grid):
    """Finds the first available open cell (0) from the top-left."""
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] == 0:
                return (r, c)
    return None

def find_last_open(grid):
    """Finds the first available open cell (0) from the bottom-right."""
    for r in range(len(grid) - 1, -1, -1):
        for c in range(len(grid[0]) - 1, -1, -1):
            if grid[r][c] == 0:
                return (r, c)
    return None

# --- Routes ---
@app.route('/')
def index():
    """Renders the main game page."""
    return render_template('index.html')

@app.route('/api/maze')
def get_maze():
    """Generates, solves, and returns a new maze with its solution path."""
    width, height = 10, 10
    m = Maze()
    m.generator = Prims(width, height)
    m.generate()

    # This is the robust way to set start/end points.
    # It guarantees they are on a valid, open path.
    m.start = find_first_open(m.grid)
    m.end = find_last_open(m.grid)

    m.solver = BacktrackingSolver()
    m.solve()

    grid_list = [[int(cell) for cell in row] for row in m.grid]
    solution_path = m.solutions[0] if m.solutions else []

    return jsonify({
        'grid': grid_list,
        'path': solution_path
    })

@app.route('/api/quiz')
def get_quiz():
    """Returns the quiz questions from the JSON file."""
    return jsonify(quiz_data)

if __name__ == '__main__':
    app.run(debug=True) 