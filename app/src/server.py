from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd

app = Flask(__name__)
CORS(app)

# ── Load model saved by model.py ──
# model.py saves to '../models/app_model.pkl' relative to itself.
# server.py sits next to model.py, so the path is the same.
model = joblib.load('../models/app_model.pkl')

# ── Build feature row — matches EXACTLY: Junction, hour, day, month, weekday ──
def build_features(junction, hour, date_str):
    """
    junction : int   1, 2, 3, or 4
    hour     : int   0–23
    date_str : str   'YYYY-MM-DD'  (value from the HTML date input)

    Extracts day, month, weekday from the date string — same way model.py did
    using dt.day, dt.month, dt.weekday on the DateTime column.
    """
    date    = pd.to_datetime(date_str)
    day     = date.day        # day of month  e.g. 15
    month   = date.month      # 1–12
    weekday = date.weekday()  # 0=Monday … 6=Sunday  (same as dt.weekday)

    # Column order must match X = df[['Junction','hour','day','month','weekday']]
    return np.array([[junction, hour, day, month, weekday]])


# ── /predict  — single junction ──
@app.route('/predict', methods=['GET'])
def predict():
    try:
        junction = int(request.args.get('junction'))   # 1–4
        hour     = int(request.args.get('hour'))        # 0–23
        date_str = request.args.get('date')             # 'YYYY-MM-DD'

        features   = build_features(junction, hour, date_str)
        vehicles   = int(round(float(model.predict(features)[0])))

        return jsonify({
            'junction': junction,
            'hour': hour,
            'date': date_str,
            'predicted_vehicles': vehicles
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


# ── /predict/all  — all 4 junctions at once (called by app.js) ──
@app.route('/predict/all', methods=['GET'])
def predict_all():
    try:
        hour     = int(request.args.get('hour'))   # 0–23
        date_str = request.args.get('date')         # 'YYYY-MM-DD'

        junction_map = {'J1': 1, 'J2': 2, 'J3': 3, 'J4': 4}
        weights = {}

        for label, num in junction_map.items():
            features      = build_features(num, hour, date_str)
            weights[label] = int(round(float(model.predict(features)[0])))

        return jsonify({
            'hour': hour,
            'date': date_str,
            'weights': weights    # { "J1": 18, "J2": 34, "J3": 9, "J4": 27 }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


if __name__ == '__main__':
    app.run(debug=True, port=5000)