import sqlite3
import requests
import time
import pulp
import pandas as pd
import matplotlib.pyplot as plt
import threading

# Constants
THERMOSTAT_URL_BASE = "http://{ip}/tstat"
API_URL = "https://api.openenergydata.org/electricity_price"
THERMOSTAT_UPDATE_THRESHOLD = 0.5  
PRICE_CHECK_INTERVAL = 300  
SCAN_INTERVAL = 60
TEST_MODE = True

# Store previous values
last_target_temp = {}
last_electricity_price = None
previous_states = {}

def get_electricity_price():
    """Fetch real-time electricity cost with error handling."""
    global last_electricity_price
    try:
        response = requests.get(API_URL, params={"region": "LA", "time": "now"}, timeout=5)
        response.raise_for_status()
        data = response.json()
        last_electricity_price = data.get("current_price", 0.15)
    except:
        last_electricity_price = 0.15  
    return last_electricity_price

def get_thermostat_data():
    """Retrieve recent thermostat readings for all thermostats."""
    conn = sqlite3.connect('..\\thermostat_data.db')
    cursor = conn.cursor()
    cursor.execute("""
        SELECT ip, temp, tTemp, tstate, fstate, timestamp 
        FROM scan_data
        WHERE timestamp >= (strftime('%s', 'now') - 7 * 24 * 60 * 60) * 1000
        ORDER BY ip, timestamp DESC
    """)
        #ORDER BY timestamp DESC LIMIT 50
    data = cursor.fetchall()
    conn.close()
    return data

def detect_cycling(ip, fstate, tstate):
    """Detect HVAC and fan cycling events."""
    cycling_penalty = 0
    if ip in previous_states:
        prev_fstate, prev_tstate = previous_states[ip]
        if prev_fstate == 0 and fstate == 1:
            cycling_penalty += 2  
        if prev_tstate == 0 and tstate in [1, 2]:
            cycling_penalty += 5  
    previous_states[ip] = (fstate, tstate)
    return cycling_penalty

def optimize_hvac(current_price, thermostat_data):
    """Optimize HVAC operation for each thermostat."""
    recommendations = {}

    for entry in thermostat_data:
        ip, temp, tTemp, tstate, fstate, _ = entry

        hvac_model = pulp.LpProblem("HVAC_Optimization", pulp.LpMinimize)

        compressor_var = pulp.LpVariable("compressor_status", 0, 1, cat="Binary")
        runtime_var = pulp.LpVariable("runtime_hours", 0, 6)  
        target_temp_var = pulp.LpVariable("target_temp", 74, 78)  

        startup_cost = 10  
        runtime_cost = current_price  
        cycling_penalty = detect_cycling(ip, fstate, tstate)  

        current_temp = temp
        target_temp = tTemp if tTemp is not None else 76  # Default value if missing

        hvac_model += (
            compressor_var * startup_cost + runtime_var * runtime_cost + cycling_penalty
        ), "Total Energy Cost"

        hvac_model += current_temp - compressor_var * 2 >= target_temp_var - 2  
        hvac_model += runtime_var >= 0.5  # Ensure runtime is meaningful
        hvac_model += runtime_var <= 6  
        hvac_model += target_temp_var >= target_temp - 1  

        hvac_model.solve()

        recommendations[ip] = {
            "optimal_compressor": compressor_var.varValue,
            "recommended_runtime": runtime_var.varValue,
            "optimized_target_temp": target_temp_var.varValue,
        }

    return recommendations

def update_thermostat(ip, target_temp, mode):
    """Send optimized temperature setting to each thermostat."""
    global last_target_temp
    if ip not in last_target_temp or abs(target_temp - last_target_temp[ip]) > THERMOSTAT_UPDATE_THRESHOLD:
        payload = {
            "tmode": mode,
            "t_cool" if mode == 2 else "t_heat": target_temp
        }
        if TEST_MODE:
            print(f"**TEST** Thermostat {ip} Target Mode: {mode}, Target Temp: {target_temp}°F")
            return True
        else:
            response = requests.post(THERMOSTAT_URL_BASE.format(ip=ip), json=payload)

        if response.status_code == 200:
            last_target_temp[ip] = target_temp
            print(f"Thermostat {ip} updated successfully! Mode: {mode}, Target Temp: {target_temp}°F")
            return True
        else:
            print(f"Failed to update thermostat {ip}.")
            return False
    return False

def generate_analytics(thermostat_data):
    """Generate non-blocking historical vs projected runtime analysis."""
    df = pd.DataFrame(thermostat_data, columns=["IP", "Current Temp", "Target Temp", "HVAC State", "Fan State", "Timestamp"])
    df["Timestamp"] = pd.to_datetime(df["Timestamp"] / 1000, unit="s")

    plt.ion()  # Enable interactive mode
    plt.figure(figsize=(12, 6))
    for ip, data in df.groupby("IP"):
        plt.plot(data["Timestamp"], data["Current Temp"], label=f"{ip} - Temp")

    plt.xlabel("Time")
    plt.ylabel("Temperature (°F)")
    plt.title("Historical Temperature Trends with Cycling Considerations")
    plt.legend()
    plt.pause(1)
    #plt.close()  

def run_analytics_thread():
    """Run analytics chart updates in a separate thread."""
    while True:
        thermostat_data = get_thermostat_data()
        generate_analytics(thermostat_data)
        time.sleep(300)  

# Start analytics thread
#threading.Thread(target=run_analytics_thread, daemon=True).start()

# Continuous monitoring & control loop
counter = 0
while True:
    print("\nRunning HVAC optimization...")

    if counter % (PRICE_CHECK_INTERVAL // SCAN_INTERVAL) == 0:
        current_price = get_electricity_price()
        print(f"Updated electricity price: ${current_price:.2f}/kWh")

    thermostat_data = get_thermostat_data()
    recommendations = optimize_hvac(last_electricity_price, thermostat_data)

    for ip, rec in recommendations.items():
        optimal_compressor = rec["optimal_compressor"]
        recommended_runtime = rec["recommended_runtime"]
        optimized_target_temp = rec["optimized_target_temp"]

        print(f"Thermostat {ip}: Compressor {'ON' if optimal_compressor else 'OFF'}, Runtime: {recommended_runtime:.2f} hrs, Temp: {optimized_target_temp:.2f}°F")

        update_thermostat(ip, optimized_target_temp, 2)

    time.sleep(SCAN_INTERVAL)
    counter += 1