import os, sys, inspect
current_dir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parent_dir = os.path.dirname(current_dir)
grand_parent_dir = os.path.dirname(parent_dir)
sys.path.insert(0, grand_parent_dir)
import examples_generator.libgen as gen

# build the network

lengths = [
    1000, # 0
    2500,
    2500,
    5000,
    5000,
    5000, # 5
    1000,
    5000,
    5000,
    5000,
    1000, # 10
    1000,
    5000,
    5000,
    5000,
    5000, # 15
    1000,
    1000,
    2000,
    1000,
    3000, # 20
    1000,
    500,
    2500,
    2500,
    5500, # 25
    5000,
    5000,
    1000,
    5000,
    5000, # 30
    5500,
    6500,
    5000,
    5000,
    5500, # 35
    2000,
    1500,
    1500,
    2000,
    1500, # 40
    1118,
    6708,
    1118,
    707,
    707, # 45
    707,
    707,
    1118,
    1118,
    1118, # 50
    1118,
    11180,
    11180,
    5000,
    5000, # 55
    5000,
    5385,
    11000,
    2000,
    20000, # 60
    2000,
    20000,
    1000,
    1414,
    1414, # 65
    1414,
    1414,
    1118,
    1118,
]

infra = gen.Infra(lengths)

infra.add_switch(1, 0, 41, 0, -1000) # B
infra.add_link(1, 2, 0, -3500) # C
infra.add_switch(3, 2, 43, 0, -6000) # D
infra.add_link(3, 4, 0, -11000) # E
infra.add_link(4, 5, 0, -16000) # F
infra.add_switch(5, 6, 44, 0, -21000) # G
infra.add_switch(7, 6, 45, 0, -22000) # H
infra.add_link(44, 45, -500, -21500) # W1
infra.add_link(7, 8, 0, -27000) # I
infra.add_link(8, 9, 0, -32000) # J
infra.add_switch(9, 10, 54, 0, -37000) # K
infra.add_switch(11, 10, 48, 0, -38000) # L
infra.add_switch(11, 12, 55, 0, -39000) # M
infra.add_link(12, 13, 0, -44000) # N
infra.add_link(13, 14, 0, -49000) # O
infra.add_link(14, 15, 0, -54000) # P
infra.add_link(15, 16, 0, -59000) # Q
infra.add_switch(17, 16, 49, 0, -60000) # R
infra.add_switch(17, 18, 69, 0, -61000) # S
infra.add_switch(18, 19, 52, 0, -63000) # T
infra.add_switch(19, 20, 50, 0, -64000) # U
infra.add_switch(21, 20, 51, 0, -67000) # V
infra.add_switch(22, 23, 41, 1000, -500) # A1
infra.add_switch(24, 23, 42, 1000, -3000) # B1
infra.add_switch(24, 25, 43, 1000, -5500) # C1
infra.add_link(25, 26, 1000, -11000) # E1
infra.add_link(26, 27, 1000, -16000) # F1
infra.add_switch(27, 28, 46, 1000, -21000) # G1
infra.add_switch(29, 28, 47, 1000, -22000) # H1
infra.add_link(46, 47, 1500, -21500) # Z1
infra.add_link(29, 30, 1000, -27000) # I1
infra.add_link(30, 31, 1000, -32000) # J1
infra.add_switch(31, 32, 48, 1000, -37500) # K1
infra.add_link(32, 33, 1000, -44000) # L1
infra.add_link(33, 34, 1000, -49000) # M1
infra.add_link(34, 35, 1000, -54000) # N1
infra.add_switch(35, 36, 49, 1000, -59500) # O1
infra.add_switch(37, 36, 69, 1000, -61500) # P1
infra.add_switch(37, 38, 53, 1000, -63000) # Q1
infra.add_switch(39, 38, 50, 1000, -64500) # R1
infra.add_switch(39, 40, 51, 1000, -66500) # S1
infra.add_link(54, 56, -5000, -37000) # B2
infra.add_link(55, 57, -5000, -39000) # A2
infra.add_switch(58, 56, 57, -10000, -37000) # C2
infra.add_switch(58, 59, 64, -21000, -37000) # D2
infra.add_link(64, 65, -22000, -38000) # F2
infra.add_switch(60, 59, 65, -23000, -37000) # E2
infra.add_switch(60, 61, 66, -43000, -37000) # G2
infra.add_link(66, 67, -44000, -38000) # I2
infra.add_switch(62, 61, 67, -45000, -37000) # H2
infra.add_switch(62, 63, 68, -65000, -37000) # J2

infra.set_buffer_stop_coordinates(63, -66000, -37000) # K2
infra.set_buffer_stop_coordinates(68, -66000, -38000) # L2
infra.set_buffer_stop_coordinates(0, 0, 0) # A
infra.set_buffer_stop_coordinates(22, 1000, 0) # Z
infra.set_buffer_stop_coordinates(42, 7000, 0) # D1
infra.set_buffer_stop_coordinates(52, -10000, -68000) # V1
infra.set_buffer_stop_coordinates(21, 0, -68000) # W
infra.set_buffer_stop_coordinates(40, 1000, -68000) # T1
infra.set_buffer_stop_coordinates(53, 11000, -68000) # U1

# build the trains
sim = gen.Simulation(infra)

sim.add_schedule(0, 22, 68)

# build the successions
succession = gen.Succession()

succession.add_table(1, 0, 41, []) # B
succession.add_table(3, 2, 43, []) # D
succession.add_table(5, 6, 44, []) # G
succession.add_table(7, 6, 45, []) # H
succession.add_table(9, 10, 54, []) # K
succession.add_table(11, 10, 48, []) # L
succession.add_table(11, 12, 55, []) # M
succession.add_table(17, 16, 49, []) # R
succession.add_table(17, 18, 69, []) # S
succession.add_table(18, 19, 52, []) # T
succession.add_table(19, 20, 50, []) # U
succession.add_table(21, 20, 51, []) # V
succession.add_table(22, 23, 41, []) # A1
succession.add_table(24, 23, 42, []) # B1
succession.add_table(24, 25, 43, []) # C1
succession.add_table(27, 28, 46, []) # G1
succession.add_table(29, 28, 47, []) # H1
succession.add_table(31, 32, 48, []) # K1
succession.add_table(35, 36, 49, []) # O1
succession.add_table(37, 36, 69, []) # P1
succession.add_table(37, 38, 53, []) # Q1
succession.add_table(39, 38, 50, []) # R1
succession.add_table(39, 40, 51, []) # S1
succession.add_table(58, 56, 57, []) # C2
succession.add_table(58, 59, 64, []) # D2
succession.add_table(60, 59, 65, []) # E2
succession.add_table(60, 61, 66, []) # G2
succession.add_table(62, 61, 67, []) # H2
succession.add_table(62, 63, 68, []) # J2

gen.write_all_files(infra, sim, succession)