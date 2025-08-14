from flask import Flask, jsonify, render_template
from mazelib import Maze
from mazelib.generate.Prims import Prims
import json

app = Flask(__name__)

@app.after_request
def after_request(response):
    header = response.headers
    header['Access-Control-Allow-Origin'] = '*'
    header['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    header['Access-Control-Allow-Methods'] = 'OPTIONS, HEAD, GET, POST, DELETE, PUT'
    return response

with open('quiz.json') as f:
    quiz_data = json.load(f)

@app.route('/')
def index():
    """Renders the main game page."""
    return render_template('index.html')

@app.route('/api/maze')
def get_maze():
    """Generates a new 10x10 maze and returns it."""
    m = Maze()
    m.generator = Prims(10, 10)
    m.generate()
    grid_list = [[int(cell) for cell in row] for row in m.grid]
    return jsonify(grid_list)

@app.route('/api/quiz')
def get_quiz():
    """Returns the quiz questions from the JSON file."""
    return jsonify(quiz_data)

if __name__ == '__main__':
    app.run(debug=True)
