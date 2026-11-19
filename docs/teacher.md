# Teacher guide

For the opening lesson, ask students to point to `(0, 0)` before they edit. Play Level 1’s starter once. Ask why the drone stops short and which one number students would change. In Level 2, ask what the negative sign in `Move(-3)` tells Ziki.

## 1–3 · The opening sequence

```csharp
// Level 1
Move(3);
```

```csharp
// Level 2
Move(-3);
```

In Level 3, Ziki starts at x = 0, so the rose’s x-coordinate is also the number of steps to move. Point to the supplied declaration and ask students to replace the argument in `Move(1)` with the variable name.

```csharp
int rosePosition = 2;
Move(rosePosition);
```

## 4–5 · Calculate the move east and west

The previous lesson’s `Move(rosePosition)` is the starter. Run it from x = 1 and ask why Ziki ends at x = 5. Both positions are now supplied as variables. Subtract the starting position from the destination to get the signed offset.

```csharp
int zikiPosition = 1;
int rosePosition = 4;
int offset = rosePosition - zikiPosition;
Move(offset);
```

Continue to **Calculate the Move West**. Its starter supplies x = 3 for Ziki and x = 1 for the rose. Ask students to predict the result of the same subtraction, then write it in the new lesson. The offset is −2, so Ziki moves two tiles west.

## 6–7 · Choose a reachable rose

The garden has 11 tiles, two labeled roses, and a limited battery. Each crossing uses 1 m of range. The starter contains only four declarations.

```csharp
int batteryRange = 4;
int rose1Position = 4;
int rose2Position = 9;
int zikiPosition = 1;
```

Ask students to calculate how far each rose is from Ziki and write a decision that chooses a reachable rose. Both roses are east of the starting tile in these lessons, so subtraction gives a positive travel distance.

```csharp
int distance1 = rose1Position - zikiPosition;
int distance2 = rose2Position - zikiPosition;

if (distance1 <= batteryRange)
{
    Move(distance1);
}
else if (distance2 <= batteryRange)
{
    Move(distance2);
}
```

In **Choose a Reachable Rose**, Rose 1 is 3 m away and Rose 2 is 8 m away. Ziki reaches Rose 1 with 1 m left. In **Reach a Rose on the Last Meter**, Ziki starts at x = 2 with 3 m of range. Rose 1 is at x = 8 and Rose 2 is at x = 5. Applying the same decision to the new inputs sends Ziki to Rose 2 with exactly 0 m left. Ask why the comparison includes equality.

Choosing the farther rose exhausts the battery and stops the sequence. Passing a rose during an unfinished flight leaves it in the garden.

## 8–9 · Round a display, then a location

In Level 8, give students the sensor reading of 97.75562% and ask for the nearest whole percent. Make the edit below while projecting. The run feedback reports 98%. Ask what percentage an `(int)` cast would give and why.

```csharp
UpdateBatteryPercentage(Math.Round(batteryPercentage));
```

Introduce `Move(x, y)` in Level 9. The two signed offsets tell Ziki how far to travel from the current tile, horizontally first and then vertically. Before running the starter, ask which tile is nearest to the GPS pin at (4.7, 1.6). The starter truncates and stops at (4, 1). Round and cast both coordinates, then watch Ziki fly horizontally through (5, 0) and arrive at (5, 2). For a midpoint question, compare `Math.Round(2.5)` with `Math.Round(3.5)`.

```csharp
int targetX = (int)Math.Round(gpsX);
int targetY = (int)Math.Round(gpsY);
Move(targetX - zikiX, targetY - zikiY);
```

## 10–13 · Routes, power, and square beds

At Level 10, ask students to calculate both cardinal route lengths before choosing one. Rose A is 6 m away and Rose B is 4 m away.

```csharp
int distanceA = Math.Abs(roseAX - zikiX) + Math.Abs(roseAY - zikiY);
int distanceB = Math.Abs(roseBX - zikiX) + Math.Abs(roseBY - zikiY);
int shortest = Math.Min(distanceA, distanceB);

if (shortest == distanceA)
{
    Move(roseAX - zikiX, roseAY - zikiY);
}
else
{
    Move(roseBX - zikiX, roseBY - zikiY);
}
```

At Level 11, compare the coverage at 3 m, 6 m, and 9 m. Each coverage claim is for a fresh flight from the starting tile.

```csharp
int distanceA = Math.Abs(roseAX - zikiX) + Math.Abs(roseAY - zikiY);
int distanceB = Math.Abs(roseBX - zikiX) + Math.Abs(roseBY - zikiY);
SetBatteryRange(Math.Max(distanceA, distanceB));
```

At Level 12, ask students to calculate the nine slots in the 3 × 3 tray from its side length. Ask what the seeds-left counter would show with one extra seed.

```csharp
LoadSeeds((int)Math.Pow(bedSide, 2));
PlantBed();
```

At Level 13, ask how to reverse the calculation. The last front tile for 25 seedlings is (5, 0), because the square has five columns starting at x = 1.

```csharp
int columns = (int)Math.Sqrt(seedlingCount);
Move(columns);
```
